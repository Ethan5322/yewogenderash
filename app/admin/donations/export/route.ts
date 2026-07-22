import type { DonationStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";

const STATUSES = new Set<DonationStatus>([
  "PENDING", "SUCCESS", "FAILED", "CANCELLED", "REFUNDED", "DISPUTED",
]);

function cell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of donations (finance/compliance). Respects the status filter. */
export async function GET(req: Request) {
  const admin = await requirePermission("payouts");
  const status = new URL(req.url).searchParams.get("status");
  const where: Prisma.DonationWhereInput =
    status && status !== "ALL" && STATUSES.has(status as DonationStatus)
      ? { status: status as DonationStatus }
      : {};

  const rows = await db.donation.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      createdAt: true, paidAt: true, donorName: true, amount: true,
      platformFee: true, netAmount: true, currency: true, status: true,
      txRef: true, gatewayTransactionId: true, campaign: { select: { title: true } },
    },
  });

  const header = [
    "Created", "Paid", "Donor", "Campaign", "Gross", "Fee", "Net",
    "Currency", "Status", "TxRef", "GatewayRef",
  ];
  const lines = [header.join(",")];
  for (const d of rows) {
    lines.push([
      d.createdAt.toISOString(),
      d.paidAt?.toISOString() ?? "",
      d.donorName ?? "Anonymous",
      d.campaign.title,
      Number(d.amount),
      Number(d.platformFee),
      Number(d.netAmount),
      d.currency,
      d.status,
      d.txRef,
      d.gatewayTransactionId ?? "",
    ].map(cell).join(","));
  }

  await writeAudit({ actorId: admin.id, action: "DONATIONS_EXPORTED", detail: { count: rows.length, status } });

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="donations-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

import type { PayoutStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";

const STATUSES = new Set<PayoutStatus>([
  "REQUESTED", "APPROVED", "PAID", "REJECTED", "CANCELLED",
]);

function cell(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV export of payouts (finance/compliance). Respects the status filter. */
export async function GET(req: Request) {
  const admin = await requirePermission("payouts");
  const status = new URL(req.url).searchParams.get("status");
  const where: Prisma.PayoutWhereInput =
    status && status !== "ALL" && STATUSES.has(status as PayoutStatus)
      ? { status: status as PayoutStatus }
      : {};

  const rows = await db.payout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    select: {
      createdAt: true, approvedAt: true, paidAt: true, amount: true, currency: true,
      status: true, payoutReference: true, note: true, autoApproved: true,
      campaign: { select: { title: true } },
      owner: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  const header = [
    "Created", "Approved", "Paid", "Campaign", "Owner", "Email",
    "Amount", "Currency", "Status", "AutoApproved", "Reference", "Note",
  ];
  const lines = [header.join(",")];
  for (const p of rows) {
    lines.push([
      p.createdAt.toISOString(),
      p.approvedAt?.toISOString() ?? "",
      p.paidAt?.toISOString() ?? "",
      p.campaign.title,
      p.owner.user.name,
      p.owner.user.email,
      Number(p.amount),
      p.currency,
      p.status,
      p.autoApproved ? "yes" : "no",
      p.payoutReference ?? "",
      p.note ?? "",
    ].map(cell).join(","));
  }

  await writeAudit({ actorId: admin.id, action: "PAYOUTS_EXPORTED", detail: { count: rows.length, status } });

  return new Response(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="payouts-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

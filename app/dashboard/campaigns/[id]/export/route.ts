import { auth } from "@/auth";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

/** One CSV cell, quoted and quote-escaped so commas/quotes never break it. */
function cell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/**
 * Download the donation ledger for one of the owner's own campaigns as CSV.
 * Ownership is enforced in the query — an owner can only export their own.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const campaign = await db.campaign.findFirst({
    where: { id, owner: { userId: session.user.id } },
    select: {
      queryCode: true,
      currency: true,
      donations: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          paidAt: true,
          donorName: true,
          amount: true,
          currency: true,
          status: true,
          txRef: true,
        },
      },
    },
  });
  if (!campaign) {
    return new Response("Not found", { status: 404 });
  }

  const header = ["Date", "Donor", "Amount", "Currency", "Status", "Reference"];
  const rows = campaign.donations.map((d) =>
    [
      (d.paidAt ?? d.createdAt).toISOString().slice(0, 10),
      d.donorName ?? "Anonymous",
      toNumber(d.amount).toFixed(2),
      d.currency,
      d.status,
      d.txRef,
    ]
      .map(cell)
      .join(",")
  );
  const csv = [header.map(cell).join(","), ...rows].join("\r\n");

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="donations-${campaign.queryCode}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

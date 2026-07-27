import Link from "next/link";
import { Landmark, Percent, HandCoins, Wallet } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { toNumber, formatETB } from "@/lib/format";
import {
  PageHeader,
  KpiCard,
  TableFrame,
  Thead,
  Th,
  EmptyRow,
} from "@/components/admin/ui";
import { PermLink } from "@/components/admin/perm-link";

export const metadata = { title: "Admin · Fundraiser balances" };

/**
 * Every fundraiser's money in one table — what they raised, what the platform
 * took, what has been paid out, and what they can still withdraw.
 *
 * Financial control is admin-only (brief invariant), so this sits behind the
 * `payouts` capability: the main admin holds it implicitly, a finance admin can
 * be delegated it, and a KYC/support/content sub-admin never sees these figures.
 *
 * Balances are derived from the donation and payout ledgers, so they stay
 * correct even if the CampaignBalance denorm drifts. Funds remain held PER
 * CAMPAIGN — the owner totals here are a reporting rollup, never a pooled purse.
 */
export default async function AdminBalancesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("payouts");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const owners = await db.campaignOwner.findMany({
    where: q
      ? {
          OR: [
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { authorCode: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    select: {
      id: true,
      authorCode: true,
      mulesooVerified: true,
      user: { select: { name: true, email: true } },
      campaigns: { select: { id: true } },
    },
  });

  const ownerIds = owners.map((o) => o.id);
  const campaignToOwner = new Map<string, string>();
  for (const o of owners) for (const c of o.campaigns) campaignToOwner.set(c.id, o.id);
  const campaignIds = [...campaignToOwner.keys()];

  // Two grouped aggregates for the whole page rather than a query per owner.
  const [donationRows, payoutRows] = campaignIds.length
    ? await Promise.all([
        db.donation.groupBy({
          by: ["campaignId"],
          where: { campaignId: { in: campaignIds }, status: "SUCCESS" },
          _sum: { amount: true, platformFee: true, netAmount: true },
        }),
        db.payout.groupBy({
          by: ["campaignId", "status"],
          where: {
            campaignId: { in: campaignIds },
            status: { in: ["REQUESTED", "APPROVED", "PAID"] },
          },
          _sum: { amount: true },
        }),
      ])
    : [[], []];

  type Row = {
    gross: number;
    fees: number;
    net: number;
    paid: number;
    reserved: number;
  };
  const blank = (): Row => ({ gross: 0, fees: 0, net: 0, paid: 0, reserved: 0 });
  const byOwner = new Map<string, Row>(ownerIds.map((id) => [id, blank()]));

  for (const r of donationRows) {
    const ownerId = campaignToOwner.get(r.campaignId);
    if (!ownerId) continue;
    const row = byOwner.get(ownerId)!;
    row.gross += toNumber(r._sum.amount ?? 0);
    row.fees += toNumber(r._sum.platformFee ?? 0);
    row.net += toNumber(r._sum.netAmount ?? 0);
  }
  for (const r of payoutRows) {
    const ownerId = campaignToOwner.get(r.campaignId);
    if (!ownerId) continue;
    const row = byOwner.get(ownerId)!;
    const amount = toNumber(r._sum.amount ?? 0);
    if (r.status === "PAID") row.paid += amount;
    else row.reserved += amount;
  }

  const rows = owners
    .map((o) => {
      const b = byOwner.get(o.id) ?? blank();
      return {
        ...o,
        ...b,
        available: b.net - b.paid - b.reserved,
        campaignCount: o.campaigns.length,
      };
    })
    // Biggest available balance first — that is what an admin acts on.
    .sort((a, b) => b.available - a.available || b.gross - a.gross);

  const totals = rows.reduce(
    (acc, r) => ({
      gross: acc.gross + r.gross,
      fees: acc.fees + r.fees,
      net: acc.net + r.net,
      paid: acc.paid + r.paid,
      available: acc.available + r.available,
    }),
    { gross: 0, fees: 0, net: 0, paid: 0, available: 0 }
  );

  return (
    <div>
      <PageHeader
        title="Fundraiser balances"
        description="What every fundraiser has raised, been paid, and can still withdraw."
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KpiCard label="Raised (gross)" value={formatETB(totals.gross)} sub="all fundraisers" icon={HandCoins} tone="brand" />
        <KpiCard label="Platform fees" value={formatETB(totals.fees)} sub="collected" icon={Percent} tone="brand" />
        <KpiCard label="Paid out" value={formatETB(totals.paid)} sub="released" icon={Landmark} tone="success" />
        <KpiCard label="Outstanding" value={formatETB(totals.available)} sub="still withdrawable" icon={Wallet} tone="info" />
      </div>

      <form className="mt-6" action="/admin/balances">
        <input
          type="search"
          name="q"
          defaultValue={q}
          placeholder="Search fundraiser by name, email or author code…"
          className="h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 text-sm shadow-sm"
        />
      </form>

      <div className="mt-4">
        <TableFrame minWidth={960}>
          <Thead>
            <Th>Fundraiser</Th>
            <Th className="text-right">Campaigns</Th>
            <Th className="text-right">Gross</Th>
            <Th className="text-right">Fees</Th>
            <Th className="text-right">Net</Th>
            <Th className="text-right">Paid</Th>
            <Th className="text-right">Reserved</Th>
            <Th className="text-right">Available</Th>
          </Thead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={8}>
                {q ? "No fundraiser matches that search." : "No fundraisers yet."}
              </EmptyRow>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <PermLink
                      perm="kyc"
                      href={`/admin/owners/${r.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {r.user.name}
                    </PermLink>
                    <p className="text-xs text-muted-foreground">
                      {r.authorCode ?? "—"} · {r.user.email}
                      {r.mulesooVerified ? "" : " · unverified"}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-right">{r.campaignCount}</td>
                  <td className="px-4 py-3 text-right">{formatETB(r.gross)}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">{formatETB(r.fees)}</td>
                  <td className="px-4 py-3 text-right">{formatETB(r.net)}</td>
                  <td className="px-4 py-3 text-right text-success">{formatETB(r.paid)}</td>
                  <td className="px-4 py-3 text-right">{formatETB(r.reserved)}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatETB(r.available)}</td>
                </tr>
              ))
            )}
          </tbody>
        </TableFrame>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Funds are held per campaign and never pooled — an owner total is a
        reporting rollup only. Figures are computed from the donation and payout
        ledgers.
      </p>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, HandCoins, Wallet, Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { campaignAvailableBalance } from "@/lib/payouts";
import { formatETB, toNumber } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

/**
 * What a fundraiser has raised and can withdraw, on the screen they land on.
 *
 * The dashboard used to be four navigation cards with no figure anywhere — the
 * first thing anyone wants on signing in is their money, and finding it took a
 * click into Payouts. Each campaign links to its own transaction statement,
 * which is otherwise only reachable from the payouts page.
 *
 * Balances are per campaign because that is how funds are actually held; the
 * headline is a reporting total, never a pooled purse.
 */
export async function BalanceSummary({ ownerId }: { ownerId: string }) {
  const t = (await getDictionary()).dashboard.money;
  const campaigns = await db.campaign.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, currency: true, currentAmount: true, status: true },
  });
  if (campaigns.length === 0) return null;

  const rows = await Promise.all(
    campaigns.map(async (c) => ({
      ...c,
      raised: toNumber(c.currentAmount),
      available: await campaignAvailableBalance(c.id),
    }))
  );

  const totalRaised = rows.reduce((a, r) => a + r.raised, 0);
  const totalAvailable = rows.reduce((a, r) => a + r.available, 0);
  const currency = rows[0]?.currency ?? "ETB";

  return (
    <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-base font-semibold">{t.title}</h2>
        <Link
          href="/dashboard/payouts"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          {t.payoutsLink} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <HandCoins className="h-3.5 w-3.5" aria-hidden /> {t.raised}
          </p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums">
            {formatETB(totalRaised, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wallet className="h-3.5 w-3.5" aria-hidden /> {t.available}
          </p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums text-primary">
            {formatETB(totalAvailable, currency)}
          </p>
          <p className="text-xs text-muted-foreground">{t.afterFee}</p>
        </div>
        <div className="rounded-lg border bg-muted/30 p-4">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Megaphone className="h-3.5 w-3.5" aria-hidden /> {t.campaigns}
          </p>
          <p className="mt-1 font-display text-lg font-bold tabular-nums">{rows.length}</p>
        </div>
      </div>

      <ul className="mt-4 divide-y rounded-lg border">
        {rows.map((c) => (
          <li key={c.id}>
            <Link
              href={`/dashboard/campaigns/${c.id}/transactions`}
              className="group flex items-center justify-between gap-4 p-3 transition-colors hover:bg-muted/40"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{c.title}</span>
                <span className="text-xs text-muted-foreground">
                  {c.status} · {t.viewTransactions}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="font-semibold tabular-nums">
                  {formatETB(c.available, c.currency)}
                </span>
                <ArrowRight
                  className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

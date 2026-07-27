import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ShieldCheck, Info } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatusChip } from "@/components/admin/ui";
import { campaignAvailableBalance, campaignWithholdingDue } from "@/lib/payouts";
import { PLATFORM_FEE_RATE, WITHHOLDING_FEE_RATE } from "@/lib/fees";
import { maskDonorName, maskReference } from "@/lib/privacy";
import { formatETB, formatDateTime, toNumber } from "@/lib/format";

export const metadata = { title: "Transaction statement" };

const pct = (rate: number) => `${Math.round(rate * 100)}%`;

/**
 * The fundraiser's own transaction statement — what this balance is made of.
 *
 * Reached by clicking the balance on the payouts page. It accounts for every
 * birr: what each donor paid, the transaction fee taken from it, and what was
 * credited. Donor identities are masked at the point each row is built (see
 * lib/privacy.ts) — a fundraiser sees that a gift arrived, never who to contact
 * about it.
 *
 * Ownership-scoped: a campaign belonging to anyone else is a 404, not a redirect,
 * so this page never confirms that another fundraiser's campaign exists.
 */
export default async function OwnerTransactionsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/payouts");
  const { id } = await params;

  const campaign = await db.campaign.findFirst({
    where: { id, owner: { userId: session.user.id } },
    select: {
      id: true,
      title: true,
      slug: true,
      currency: true,
      queryCode: true,
      donations: {
        where: { status: { in: ["SUCCESS", "REFUNDED", "DISPUTED"] } },
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        select: {
          id: true,
          amount: true,
          platformFee: true,
          netAmount: true,
          currency: true,
          status: true,
          donorName: true,
          txRef: true,
          paidAt: true,
          createdAt: true,
        },
      },
    },
  });
  if (!campaign) notFound();

  const [available, withholding] = await Promise.all([
    campaignAvailableBalance(campaign.id),
    campaignWithholdingDue(campaign.id),
  ]);

  const settled = campaign.donations.filter((d) => d.status === "SUCCESS");
  const gross = settled.reduce((a, d) => a + toNumber(d.amount), 0);
  const fees = settled.reduce((a, d) => a + toNumber(d.platformFee ?? 0), 0);
  const credited = settled.reduce((a, d) => a + toNumber(d.netAmount ?? d.amount), 0);
  const cur = campaign.currency;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/payouts"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Payouts
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Transaction statement
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {campaign.title} · querycode{" "}
          <span className="font-mono">{campaign.queryCode}</span>
        </p>

        {/* How the balance is built up */}
        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">How your balance is calculated</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">
                Total donated by {settled.length} {settled.length === 1 ? "donor" : "donors"}
              </dt>
              <dd className="font-medium tabular-nums">{formatETB(gross, cur)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">
                Transaction fee ({pct(PLATFORM_FEE_RATE)} of each donation)
              </dt>
              <dd className="tabular-nums text-destructive">− {formatETB(fees, cur)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-2">
              <dt className="font-medium">
                Credited to your campaign ({pct(1 - PLATFORM_FEE_RATE)})
              </dt>
              <dd className="font-semibold tabular-nums">{formatETB(credited, cur)}</dd>
            </div>
            <div className="flex items-center justify-between gap-4">
              <dt className="text-muted-foreground">Already withdrawn or reserved</dt>
              <dd className="tabular-nums text-muted-foreground">
                − {formatETB(Math.max(0, credited - available), cur)}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-4 border-t pt-2">
              <dt className="font-semibold">Available to withdraw now</dt>
              <dd className="font-display text-lg font-bold tabular-nums text-primary">
                {formatETB(available, cur)}
              </dd>
            </div>
          </dl>

          {/* The 7% is charged at withdrawal, so it is disclosed here too. */}
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-xs">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
            <p className="text-muted-foreground">
              A <strong className="text-foreground">safety &amp; guarantee withholding of{" "}
              {pct(WITHHOLDING_FEE_RATE)} of the total donated</strong> is deducted when you
              withdraw. It is charged once per campaign, not on every withdrawal.
              {withholding.due > 0 ? (
                <>
                  {" "}
                  Outstanding on this campaign:{" "}
                  <strong className="text-foreground">{formatETB(withholding.due, cur)}</strong>{" "}
                  of {formatETB(withholding.total, cur)}.
                </>
              ) : withholding.total > 0 ? (
                <> It has already been collected in full on this campaign.</>
              ) : null}{" "}
              See <Link href="/support/fees" className="text-primary hover:underline">Fees &amp; payouts</Link>{" "}
              and the{" "}
              <Link href="/support/terms" className="text-primary hover:underline">Terms</Link>.
            </p>
          </div>
        </section>

        {/* Per-donation detail */}
        <section className="mt-6 rounded-xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
            <h2 className="font-display text-base font-semibold">Every transaction</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
              Donor identities are protected
            </span>
          </div>
          {campaign.donations.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">
              No donations yet. Share your campaign link to start receiving support.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Donor</th>
                    <th className="px-4 py-3 font-medium">Reference</th>
                    <th className="px-4 py-3 text-right font-medium">Donated</th>
                    <th className="px-4 py-3 text-right font-medium">
                      Fee ({pct(PLATFORM_FEE_RATE)})
                    </th>
                    <th className="px-4 py-3 text-right font-medium">Credited</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.donations.map((d) => {
                    const g = toNumber(d.amount);
                    const f = toNumber(d.platformFee ?? 0);
                    const n = toNumber(d.netAmount ?? d.amount);
                    return (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {formatDateTime(d.paidAt ?? d.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          {/* An anonymous gift stores no name, which
                              maskDonorName renders as "Anonymous". */}
                          {maskDonorName(d.donorName)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {maskReference(d.txRef)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {formatETB(g, d.currency)}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
                          − {formatETB(f, d.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-medium tabular-nums">
                          {formatETB(n, d.currency)}
                        </td>
                        <td className="px-4 py-3">
                          <StatusChip status={d.status} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="border-t p-4 text-xs text-muted-foreground">
            Donors are shown by first name and initial only. Email addresses,
            phone numbers and full payment references are never shared with
            fundraisers — donors gave their details to Yewogen Derash, not to
            you. Contact support if you need a gift traced.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

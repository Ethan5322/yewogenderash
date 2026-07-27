import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { compactETB, type PlatformTotals } from "@/lib/platform-stats";

type Copy = {
  eyebrow: string;
  title: string;
  sub: string;
  browse: string;
  how: string;
  statRaised: string;
  statDonations: string;
  statCampaigns: string;
  statFundraisers: string;
};

/**
 * The homepage's opening statement.
 *
 * Kept deliberately compact — the campaign grid still starts high on the page,
 * because live causes are what this site is for. What this adds is the thing a
 * first-time visitor previously had no way to learn without scrolling: what
 * Yewogen Derash is, and that other people have already given through it.
 *
 * A stat is only rendered when it is non-zero. Showing "ETB 0 raised" to a
 * first-time visitor is worse than showing nothing at all, and on a brand-new
 * deployment every one of these is zero.
 */
export function HomeHero({
  copy,
  totals,
}: {
  copy: Copy;
  totals: PlatformTotals;
}) {
  const stats = [
    { value: compactETB(totals.raised), label: copy.statRaised, show: totals.raised > 0 },
    {
      value: totals.donations.toLocaleString("en-US"),
      label: copy.statDonations,
      show: totals.donations > 0,
    },
    {
      value: totals.campaigns.toLocaleString("en-US"),
      label: copy.statCampaigns,
      show: totals.campaigns > 0,
    },
    {
      value: totals.verifiedFundraisers.toLocaleString("en-US"),
      label: copy.statFundraisers,
      show: totals.verifiedFundraisers > 0,
    },
  ].filter((s) => s.show);

  return (
    <section className="border-b bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_10%,transparent)_0%,transparent_65%)]">
      <div className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6 sm:py-20">
        <p className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/70 px-3 py-1 text-xs font-medium text-primary">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {copy.eyebrow}
        </p>

        <h1 className="mx-auto mt-5 max-w-3xl font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">
          {copy.title}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-pretty text-muted-foreground sm:text-lg">
          {copy.sub}
        </p>

        <div className="mt-7 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg">
            <Link href="/campaigns">
              {copy.browse} <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/support/faq">{copy.how}</Link>
          </Button>
        </div>

        {stats.length > 0 ? (
          <dl className="mx-auto mt-12 grid max-w-2xl grid-cols-2 gap-x-6 gap-y-6 border-t pt-8 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd>
                  <span className="block font-display text-xl font-bold tabular-nums sm:text-2xl">
                    {s.value}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {s.label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </section>
  );
}

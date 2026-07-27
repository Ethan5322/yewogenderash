import Link from "next/link";
import { CheckCircle2, ImageIcon, ArrowRight, Quote } from "lucide-react";
import type { DeliveredCampaign } from "@/lib/campaigns";
import { formatETB, formatDate } from "@/lib/format";

type Copy = {
  title: string;
  sub: string;
  raisedLabel: string;
  completedLabel: string;
  viewLabel: string;
  noUpdate: string;
};

/**
 * "Funded & delivered" — completed campaigns with the owner's closing update.
 *
 * The whole platform asks a donor to trust a stranger with money. The most
 * convincing answer is a campaign that finished and an owner who said what
 * happened, so this leads with their words and treats the amount as secondary.
 *
 * Renders nothing at all when there are no completed campaigns: an empty
 * "delivered" section would undercut exactly the confidence it exists to build.
 */
export function DeliveredCampaigns({
  campaigns,
  copy,
}: {
  campaigns: DeliveredCampaign[];
  copy: Copy;
}) {
  if (campaigns.length === 0) return null;

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-16">
        <div className="text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            {copy.title}
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {copy.sub}
          </h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {campaigns.map((c) => (
            <article
              key={c.id}
              className="flex flex-col overflow-hidden rounded-xl border bg-background shadow-sm"
            >
              <div className="relative aspect-[16/9] bg-accent/40">
                {c.heroImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- user uploads on arbitrary hosts
                  <img
                    src={c.heroImageUrl}
                    alt={c.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground/40">
                    <ImageIcon className="h-8 w-8" aria-hidden />
                  </div>
                )}
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-0.5 text-xs font-semibold text-success-foreground shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                  {copy.completedLabel}
                </span>
              </div>

              <div className="flex flex-1 flex-col p-5">
                <h3 className="font-display text-base font-semibold leading-snug">
                  {c.title}
                </h3>

                {/* The outcome, in the fundraiser's own words. */}
                {c.latestUpdate ? (
                  <blockquote className="mt-3 flex-1 border-l-2 border-success/40 pl-3">
                    <p className="text-sm font-medium">{c.latestUpdate.title}</p>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {c.latestUpdate.body}
                    </p>
                    <footer className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <Quote className="h-3 w-3" aria-hidden />
                      {formatDate(c.latestUpdate.createdAt)}
                    </footer>
                  </blockquote>
                ) : (
                  <p className="mt-3 flex-1 text-sm text-muted-foreground">
                    {copy.noUpdate}
                  </p>
                )}

                <dl className="mt-4 border-t pt-3 text-sm">
                  <dt className="text-xs text-muted-foreground">{copy.raisedLabel}</dt>
                  <dd className="font-display text-lg font-bold tabular-nums">
                    {formatETB(c.raised, c.currency)}
                  </dd>
                </dl>

                <Link
                  href={`/campaigns/${c.slug}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  {copy.viewLabel}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                </Link>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

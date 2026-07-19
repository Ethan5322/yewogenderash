import Link from "next/link";
import { MapPin, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { MulesooStamp } from "@/components/campaigns/verified-badges";
import { CATEGORY_LABELS, type CampaignCard as CampaignCardData } from "@/lib/campaign-types";
import { formatETB, progressPercent } from "@/lib/format";

export function CampaignCard({ campaign }: { campaign: CampaignCardData }) {
  const pct = progressPercent(campaign.currentAmount, campaign.targetAmount);

  return (
    <Link
      href={`/campaigns/${campaign.slug}`}
      className="group flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground shadow-sm transition-all hover:border-primary/40 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      {/* Hero */}
      <div className="relative aspect-[16/9] overflow-hidden bg-accent">
        {campaign.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads on arbitrary hosts
          <img
            src={campaign.heroImageUrl}
            alt=""
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_70%)] text-accent-foreground/40">
            <ImageIcon className="h-10 w-10" aria-hidden />
          </div>
        )}
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <Badge variant="secondary">{CATEGORY_LABELS[campaign.category]}</Badge>
          {campaign.status === "COMPLETED" ? (
            <Badge variant="verified">Fully funded</Badge>
          ) : null}
        </div>
        {campaign.mulesooVerified ? (
          <MulesooStamp className="absolute right-3 top-3" />
        ) : null}
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <h3 className="font-display text-base font-semibold leading-snug tracking-tight line-clamp-2 group-hover:text-primary">
          {campaign.title}
        </h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">
          {campaign.description}
        </p>

        <div className="mt-auto space-y-2 pt-1">
          <ProgressBar value={pct} label={`${pct}% funded`} />
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-semibold text-foreground">
              {formatETB(campaign.currentAmount, campaign.currency)}
            </span>
            <span className="text-muted-foreground">{pct}%</span>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>of {formatETB(campaign.targetAmount, campaign.currency)}</span>
            {campaign.location ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" aria-hidden />
                {campaign.location}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

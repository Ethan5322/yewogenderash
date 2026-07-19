import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { OwnerTrust } from "@/components/campaigns/verified-badges";
import { DonationForm } from "@/components/donate/donation-form";
import { getPublicCampaignBySlug, CATEGORY_LABELS } from "@/lib/campaigns";
import { formatETB, progressPercent } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  return {
    title: campaign ? `Donate to ${campaign.title}` : "Campaign not found",
  };
}

export default async function DonatePage({ params }: Params) {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) notFound();

  const pct = progressPercent(campaign.currentAmount, campaign.targetAmount);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`/campaigns/${campaign.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to campaign
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-5">
        {/* Summary */}
        <aside className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
            <div className="relative aspect-[16/9] bg-accent">
              {campaign.heroImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- user uploads on arbitrary hosts
                <img
                  src={campaign.heroImageUrl}
                  alt={campaign.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-accent-foreground/40">
                  <ImageIcon className="h-10 w-10" aria-hidden />
                </div>
              )}
            </div>
            <div className="p-5">
              <Badge variant="secondary">{CATEGORY_LABELS[campaign.category]}</Badge>
              <h1 className="mt-2 font-display text-lg font-semibold leading-snug">
                {campaign.title}
              </h1>
              <OwnerTrust
                className="mt-2"
                ownerName={campaign.ownerName}
                mulesooVerified={campaign.mulesooVerified}
              />
              <ProgressBar value={pct} className="mt-4" label={`${pct}% funded`} />
              <div className="mt-2 flex items-baseline justify-between text-sm">
                <span className="font-semibold">
                  {formatETB(campaign.currentAmount, campaign.currency)}
                </span>
                <span className="text-muted-foreground">
                  of {formatETB(campaign.targetAmount, campaign.currency)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* Form */}
        <div className="lg:col-span-3">
          <h2 className="font-display text-2xl font-bold tracking-tight">
            Make a donation
          </h2>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
            Your gift is isolated to this campaign — funds are never pooled.
          </p>
          <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
            <DonationForm
              campaignTitle={campaign.title}
              currency={campaign.currency}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

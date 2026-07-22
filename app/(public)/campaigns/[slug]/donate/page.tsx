import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImageIcon, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { DonationForm } from "@/components/donate/donation-form";
import { getPublicCampaignBySlug } from "@/lib/campaigns";
import { formatETB, progressPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

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
  const [campaign, dict] = await Promise.all([
    getPublicCampaignBySlug(slug),
    getDictionary(),
  ]);
  if (!campaign) notFound();

  const t = dict.donate;
  const pct = progressPercent(campaign.currentAmount, campaign.targetAmount);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href={`/campaigns/${campaign.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        {t.back}
      </Link>

      {/* Campaign statement — the fundraiser's uploaded picture as the backdrop */}
      <div className="relative mt-4 overflow-hidden rounded-2xl border shadow-sm">
        {campaign.heroImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- user uploads on arbitrary hosts
          <img
            src={campaign.heroImageUrl}
            alt={campaign.title}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_45%,#0b1620)_0%,#0b1620_75%)]" />
        )}
        {/* Readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/25" />
        {!campaign.heroImageUrl ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/25">
            <ImageIcon className="h-12 w-12" aria-hidden />
          </div>
        ) : null}

        <div className="relative flex min-h-[240px] flex-col justify-end gap-3 p-6 text-white sm:min-h-[280px] sm:p-8">
          <div>
            <Badge variant="secondary" className="bg-white/15 text-white ring-0 backdrop-blur">
              {dict.categories[campaign.category]}
            </Badge>
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {campaign.title}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-sm text-white/85">
            <span>by {campaign.ownerName}</span>
            {campaign.mulesooVerified ? (
              campaign.authorCode ? (
                <Link
                  href={`/a/${campaign.authorCode}`}
                  className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold backdrop-blur hover:bg-white/25"
                >
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {dict.campaign.verified}
                </Link>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold backdrop-blur">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> {dict.campaign.verified}
                </span>
              )
            ) : null}
          </p>

          <div className="mt-1">
            <div className="h-2 overflow-hidden rounded-full bg-white/25">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                {formatETB(campaign.currentAmount, campaign.currency)}
              </span>
              <span className="text-white/80">
                {pct}% of {formatETB(campaign.targetAmount, campaign.currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Donation form */}
      <div className="mt-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">{t.title}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
          {t.isolated}
        </p>
        <div className="mt-4 rounded-xl border bg-card p-6 shadow-sm">
          {campaign.status === "ACTIVE" ? (
            <DonationForm
              queryCode={campaign.queryCode}
              campaignTitle={campaign.title}
              currency={campaign.currency}
            />
          ) : (
            <p className="text-center text-sm text-muted-foreground">{t.closed}</p>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          {t.secureFee}{" "}
          <Link href="/support/fees" className="underline hover:text-foreground">
            {dict.campaign.fees}
          </Link>{" "}
          ·{" "}
          <Link href="/support/terms" className="underline hover:text-foreground">
            {dict.campaign.terms}
          </Link>
        </p>
      </div>
    </div>
  );
}

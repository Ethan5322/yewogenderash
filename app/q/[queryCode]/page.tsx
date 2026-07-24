import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ImageIcon, ShieldCheck, ExternalLink } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { OwnerTrust } from "@/components/campaigns/verified-badges";
import { DonationForm } from "@/components/donate/donation-form";
import { getPublicCampaignByQueryCode } from "@/lib/campaigns";
import { formatETB, progressPercent } from "@/lib/format";
import { getDictionary } from "@/lib/i18n";

type Params = { params: Promise<{ queryCode: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { queryCode } = await params;
  const campaign = await getPublicCampaignByQueryCode(queryCode);
  return {
    title: campaign ? `Donate to ${campaign.title}` : "Campaign not found",
    robots: { index: false, follow: false },
  };
}

export default async function QuickDonatePage({ params }: Params) {
  const { queryCode } = await params;
  const [campaign, dict] = await Promise.all([
    getPublicCampaignByQueryCode(queryCode),
    getDictionary(),
  ]);
  if (!campaign) notFound();

  const t = dict.campaign;
  const pct = progressPercent(campaign.currentAmount, campaign.targetAmount);

  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-4 py-6">
      <header className="flex items-center justify-between">
        <Logo />
        <span className="font-mono text-xs text-muted-foreground">
          {campaign.queryCode}
        </span>
      </header>

      <main className="mt-6 flex-1">
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
            <Badge variant="secondary" className="absolute left-3 top-3">
              {dict.categories[campaign.category]}
            </Badge>
          </div>

          <div className="p-5">
            <h1 className="font-display text-lg font-semibold leading-snug">
              {campaign.title}
            </h1>
            <OwnerTrust
              className="mt-2"
              ownerName={campaign.ownerName}
              mulesooVerified={campaign.mulesooVerified}
              byLabel={t.by}
              verifiedLabel={t.verifiedOwner}
            />

            <ProgressBar value={pct} className="mt-4" label={`${pct}% ${t.funded}`} />
            <div className="mt-2 flex items-baseline justify-between text-sm">
              <span className="font-semibold">
                {formatETB(campaign.currentAmount, campaign.currency)}
              </span>
              <span className="text-muted-foreground">
                {pct}% · {t.goal} {formatETB(campaign.targetAmount, campaign.currency)}
              </span>
            </div>

            <div className="mt-6 border-t pt-6">
              {campaign.status === "ACTIVE" ? (
                <DonationForm
                  queryCode={campaign.queryCode}
                  campaignTitle={campaign.title}
                  currency={campaign.currency}
                  compact
                />
              ) : (
                <p className="text-center text-sm text-muted-foreground">
                  {dict.donate.closed}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
          {t.onlyThis}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
          {dict.donate.secureFee}{" "}
          <Link href="/support/fees" className="underline hover:text-foreground">
            {t.fees}
          </Link>
        </p>

        <div className="mt-4 text-center">
          <Link
            href={`/campaigns/${campaign.slug}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            {t.seeFull} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </main>
    </div>
  );
}

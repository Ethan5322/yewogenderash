import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  MapPin,
  Users,
  HeartHandshake,
  ImageIcon,
  QrCode,
  ShieldCheck,
  Flag,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { MulesooStamp, OwnerTrust } from "@/components/campaigns/verified-badges";
import { MobileDonateBar } from "@/components/campaigns/mobile-donate-bar";
import { getPublicCampaignBySlug, CATEGORY_LABELS } from "@/lib/campaigns";
import { formatETB, progressPercent, formatDate } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) return { title: "Campaign not found" };
  return {
    title: campaign.title,
    description: campaign.description,
  };
}

export default async function CampaignDetailPage({ params }: Params) {
  const { slug } = await params;
  const campaign = await getPublicCampaignBySlug(slug);
  if (!campaign) notFound();

  const pct = progressPercent(campaign.currentAmount, campaign.targetAmount);
  const remaining = Math.max(0, campaign.targetAmount - campaign.currentAmount);

  const isActive = campaign.status === "ACTIVE";

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 pb-28 sm:px-6 sm:py-12 lg:pb-12">
      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href="/campaigns" className="hover:text-foreground">
          Campaigns
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground">{CATEGORY_LABELS[campaign.category]}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          <div className="relative aspect-[16/9] overflow-hidden rounded-xl border bg-accent">
            {campaign.heroImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- user uploads on arbitrary hosts
              <img
                src={campaign.heroImageUrl}
                alt={campaign.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_18%,transparent)_0%,transparent_70%)] text-accent-foreground/40">
                <ImageIcon className="h-12 w-12" aria-hidden />
              </div>
            )}
            {campaign.mulesooVerified ? (
              <MulesooStamp className="absolute right-4 top-4" />
            ) : null}
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{CATEGORY_LABELS[campaign.category]}</Badge>
            {campaign.status === "COMPLETED" ? (
              <Badge variant="verified">Fully funded</Badge>
            ) : (
              <Badge variant="outline">Active</Badge>
            )}
            {campaign.location ? (
              <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" aria-hidden />
                {campaign.location}
              </span>
            ) : null}
          </div>

          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            {campaign.title}
          </h1>
          <OwnerTrust
            className="mt-3"
            ownerName={campaign.ownerName}
            mulesooVerified={campaign.mulesooVerified}
            authorCode={campaign.authorCode}
          />

          <p className="mt-6 text-base leading-relaxed text-foreground/90">
            {campaign.description}
          </p>

          {campaign.story ? (
            <div className="mt-8">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                The story
              </h2>
              <div className="mt-3 space-y-4 whitespace-pre-line leading-relaxed text-foreground/90">
                {campaign.story}
              </div>
            </div>
          ) : null}

          {/* Updates preview */}
          <div className="mt-10 border-t pt-8">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                Updates
              </h2>
              {campaign.updates.length > 0 ? (
                <Link
                  href={`/campaigns/${campaign.slug}/updates`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              ) : null}
            </div>
            {campaign.updates.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No updates yet. The owner will post progress here.
              </p>
            ) : (
              <ul className="mt-4 space-y-4">
                {campaign.updates.slice(0, 2).map((u) => (
                  <li key={u.id} className="rounded-lg border p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="font-medium">{u.title}</h3>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(u.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                      {u.body}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Donation sidebar */}
        <aside className="lg:col-span-1">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-bold">
                  {formatETB(campaign.currentAmount, campaign.currency)}
                </span>
                <span className="text-sm text-muted-foreground">{pct}%</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                raised of {formatETB(campaign.targetAmount, campaign.currency)} goal
              </p>
              <ProgressBar value={pct} className="mt-4" label={`${pct}% funded`} />

              <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">Supporters</dt>
                    <dd className="font-semibold">{campaign.supporterCount}</dd>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <HeartHandshake className="h-4 w-4 text-muted-foreground" aria-hidden />
                  <div>
                    <dt className="text-muted-foreground">Still needed</dt>
                    <dd className="font-semibold">
                      {formatETB(remaining, campaign.currency)}
                    </dd>
                  </div>
                </div>
              </dl>

              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={`/campaigns/${campaign.slug}/donate`}>
                  Donate securely
                </Link>
              </Button>

              <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                Secure checkout · funds isolated to this campaign
              </div>
              <p className="mt-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                A 3% platform fee applies.{" "}
                <Link href="/support/fees" className="underline hover:text-foreground">
                  Fees &amp; payouts
                </Link>{" "}
                ·{" "}
                <Link href="/support/terms" className="underline hover:text-foreground">
                  Terms
                </Link>
              </p>
            </div>

            {/* Querycode card */}
            <div className="rounded-xl border bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2 text-sm font-medium">
                <QrCode className="h-4 w-4" aria-hidden />
                Campaign querycode
              </div>
              <div className="mt-3 flex items-center gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
                <img
                  src={`/q/${campaign.queryCode}/qr`}
                  alt={`QR code for querycode ${campaign.queryCode}`}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-md border"
                />
                <div>
                  <p className="font-mono text-lg font-semibold tracking-wider">
                    {campaign.queryCode}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scan or enter this code to donate to this exact campaign —
                    it never points anywhere else.
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                <Link href={`/q/${campaign.queryCode}`}>Quick donate</Link>
              </Button>
            </div>

            <div className="rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
              <p>
                Reviewed{" "}
                {campaign.reviewedAt
                  ? formatDate(campaign.reviewedAt)
                  : formatDate(campaign.createdAt)}
                . Owner code:{" "}
                <span className="font-mono">{campaign.authorCode ?? "—"}</span>
              </p>
              <Link
                href="/support/report"
                className="mt-2 inline-flex items-center gap-1 text-muted-foreground hover:text-destructive"
              >
                <Flag className="h-3.5 w-3.5" aria-hidden />
                Report this campaign
              </Link>
            </div>
          </div>
        </aside>
      </div>

      {isActive ? (
        <MobileDonateBar
          slug={campaign.slug}
          raised={campaign.currentAmount}
          currency={campaign.currency}
          pct={pct}
        />
      ) : null}
    </div>
  );
}

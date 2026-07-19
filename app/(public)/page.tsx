import Link from "next/link";
import { ShieldCheck, QrCode, Landmark, BellRing, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { listFeaturedCampaigns } from "@/lib/campaigns";

const TRUST_PILLARS = [
  {
    icon: ShieldCheck,
    title: "Verified owners",
    description:
      "Every campaign owner passes ID checks, live face verification, and manual review before going live.",
  },
  {
    icon: QrCode,
    title: "One campaign, one code",
    description:
      "Each campaign has its own querycode and QR. Your donation lands on exactly one campaign — never a shared pool.",
  },
  {
    icon: Landmark,
    title: "Separated ledgers",
    description:
      "Funds are never mixed. Each campaign has its own donation ledger and audited payout record.",
  },
  {
    icon: BellRing,
    title: "Instant confirmation",
    description:
      "Payments are confirmed by the payment gateway before they count, and owners are alerted in real time.",
  },
] as const;

// Campaign data is live — render per-request instead of requiring a database
// connection at build time. (Can move to ISR once a deploy-time DB exists.)
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await listFeaturedCampaigns(3);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden border-b">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_10%,transparent)_0%,transparent_60%)]"
          aria-hidden
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
          <Badge variant="secondary" className="mb-6">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Identity-verified crowdfunding for Ethiopia
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
            Give with confidence.{" "}
            <span className="text-primary">Every birr accounted for.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Yewogen Derash verifies every campaign owner, isolates every
            campaign&apos;s funds, and audits every payout — so your support
            reaches exactly who it was meant for.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/campaigns">Browse campaigns</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/start">Start a campaign</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Trust pillars */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
          Built for trust, end to end
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
          No mixed funds. No anonymous campaigns. No unverified payouts.
        </p>
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {TRUST_PILLARS.map((pillar) => (
            <Card key={pillar.title}>
              <CardHeader>
                <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <pillar.icon className="h-5 w-5" aria-hidden />
                </span>
                <CardTitle className="text-base">{pillar.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription>{pillar.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* Featured campaigns */}
      {featured.length > 0 ? (
        <section className="border-t bg-card">
          <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  Campaigns making a difference
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Verified causes raising funds right now.
                </p>
              </div>
              <Button asChild variant="outline">
                <Link href="/campaigns">
                  View all <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </Button>
            </div>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Closing CTA */}
      <section className="border-t">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
          <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
            Have a cause worth funding?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Become a verified owner and raise funds people can trust — with your
            own querycode, separated ledger, and audited payouts.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/start">Start a campaign</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/campaigns">Browse campaigns</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

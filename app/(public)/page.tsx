import Link from "next/link";
import { ShieldCheck, QrCode, Landmark, BellRing, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { listPublicCampaigns } from "@/lib/campaigns";

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

// Campaign data is live — render per-request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The homepage leads with ongoing campaigns — no banner, no owner CTA.
  const campaigns = await listPublicCampaigns({ sort: "newest" });
  const active = campaigns.slice(0, 9);

  return (
    <div>
      {/* Ongoing campaigns — the first thing every visitor sees */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Active campaigns
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Verified causes raising funds right now — every owner is
              identity-checked and every payout is audited.
            </p>
          </div>
          {active.length > 0 ? (
            <Button asChild variant="outline">
              <Link href="/campaigns">
                View all campaigns <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ) : null}
        </div>

        {active.length > 0 ? (
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((c) => (
              <CampaignCard key={c.id} campaign={c} />
            ))}
          </div>
        ) : (
          <div className="mt-8 rounded-xl border bg-card p-10 text-center text-muted-foreground">
            No active campaigns yet — please check back soon.
          </div>
        )}
      </section>

      {/* Why donors can trust it (informational — no CTA) */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
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
        </div>
      </section>
    </div>
  );
}

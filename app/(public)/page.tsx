import Link from "next/link";
import { ShieldCheck, QrCode, Landmark, BellRing, ArrowRight, CreditCard, Lock } from "lucide-react";
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
import { getDictionary } from "@/lib/i18n";

// Campaign data is live — render per-request.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  // The homepage leads with ongoing campaigns — no banner, no owner CTA.
  const [campaigns, dict] = await Promise.all([
    listPublicCampaigns({ sort: "newest" }),
    getDictionary(),
  ]);
  const active = campaigns.slice(0, 9);
  const h = dict.home;
  const p = h.pillars;

  const TRUST_PILLARS = [
    { icon: ShieldCheck, title: p.verifiedOwners, description: p.verifiedOwnersDesc },
    { icon: QrCode, title: p.oneCode, description: p.oneCodeDesc },
    { icon: Landmark, title: p.ledgers, description: p.ledgersDesc },
    { icon: BellRing, title: p.instant, description: p.instantDesc },
  ] as const;

  return (
    <div>
      {/* Trust strip — reassurance before anything else */}
      <div className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-center gap-x-8 gap-y-2 px-4 py-3 text-sm font-medium text-muted-foreground sm:flex-row sm:px-6">
          <span className="inline-flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden /> {dict.trust.verified}
          </span>
          <span className="inline-flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" aria-hidden /> {dict.trust.payments}
          </span>
          <span className="inline-flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" aria-hidden /> {dict.trust.secure}
          </span>
        </div>
      </div>

      {/* Ongoing campaigns — the first thing every visitor sees */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              {h.activeTitle}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">{h.activeSub}</p>
          </div>
          {active.length > 0 ? (
            <Button asChild variant="outline">
              <Link href="/campaigns">
                {h.viewAll} <ArrowRight className="h-4 w-4" aria-hidden />
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
            {h.empty}
          </div>
        )}
      </section>

      {/* Why donors can trust it (informational — no CTA) */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight sm:text-3xl">
            {h.trustTitle}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
            {h.trustSub}
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

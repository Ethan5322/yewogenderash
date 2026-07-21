import type { Metadata } from "next";
import Link from "next/link";
import {
  UserPlus,
  BadgeCheck,
  FileText,
  ScanFace,
  ClipboardCheck,
  Rocket,
  ShieldCheck,
  IdCard,
  Landmark,
  FileCheck2,
} from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Start a campaign",
  description:
    "Become a verified campaign owner on Yewogen Derash. Complete identity verification, get the Mulesoo trust seal, and raise funds transparently.",
};

const STEPS = [
  {
    icon: UserPlus,
    title: "Create your account",
    description: "Sign up with your email and phone number, then verify both with a one-time code.",
  },
  {
    icon: FileText,
    title: "Accept terms & fees",
    description: "Review and accept the platform terms, fee policy, and consent notices.",
  },
  {
    icon: IdCard,
    title: "Upload your identity",
    description: "Provide a national ID or passport, plus a supporting document for your cause.",
  },
  {
    icon: ScanFace,
    title: "Verify your face",
    description: "Complete a quick live face capture so we can match it to your ID.",
  },
  {
    icon: ClipboardCheck,
    title: "Admin review",
    description: "Our team reviews your submission. This protects donors and keeps the platform trusted.",
  },
  {
    icon: Rocket,
    title: "Launch your campaign",
    description: "Once approved, you receive the Mulesoo seal and can create campaigns with their own querycodes.",
  },
] as const;

const REQUIREMENTS = [
  { icon: IdCard, label: "National ID or passport" },
  { icon: ScanFace, label: "Live face capture" },
  { icon: Landmark, label: "Payout account details" },
  { icon: FileCheck2, label: "Supporting document for your cause" },
] as const;

export default async function StartPage() {
  // Logged-in users continue straight into the wizard; guests register first
  // (the wizard is the next stop after account creation).
  const session = await auth();
  const beginHref = session?.user
    ? "/start/verify"
    : "/register?next=/start/verify";

  return (
    <div>
      {/* Hero */}
      <section className="border-b bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_9%,transparent)_0%,transparent_60%)]">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <Badge variant="gold" className="mb-6">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            Verified campaign owners only
          </Badge>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            Raise funds people can{" "}
            <span className="text-primary">trust</span>.
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground sm:text-lg">
            Yewogen Derash campaigns are for verified owners only. That verification
            is exactly why donors give with confidence — and why your campaign
            stands out.
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={beginHref}>Begin verification</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/support/fees">See fees & payouts</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          How verification works
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          Six steps stand between an idea and a live, verified campaign.
        </p>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative rounded-lg border bg-card p-6 shadow-sm">
              <span className="absolute right-5 top-5 font-display text-2xl font-bold text-muted-foreground/20">
                {i + 1}
              </span>
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <step.icon className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="font-display text-base font-semibold">{step.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Requirements */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                What you&apos;ll need
              </h2>
              <p className="mt-3 text-muted-foreground">
                Have these ready to move through verification quickly. Everything
                you upload is stored privately and seen only by authorised
                administrators.
              </p>
              <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                Documents are never shown publicly or shared.
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {REQUIREMENTS.map((r) => (
                <li key={r.label} className="flex items-center gap-3 rounded-lg border p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                    <r.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <span className="text-sm font-medium">{r.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border bg-background p-8 text-center">
            <h3 className="font-display text-xl font-semibold">Ready to begin?</h3>
            <p className="max-w-lg text-sm text-muted-foreground">
              Create your account and continue straight through every
              verification step — phone &amp; email, terms, documents, and a live
              face check — then submit for admin review.
            </p>
            <Button asChild size="lg">
              <Link href={beginHref}>Begin verification</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

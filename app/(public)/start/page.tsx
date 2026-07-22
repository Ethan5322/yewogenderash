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
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Start a campaign",
  description:
    "Become a verified campaign owner on Yewogen Derash. Complete identity verification, get the Mulesoo trust seal, and raise funds transparently.",
};

const STEP_ICONS = [UserPlus, FileText, IdCard, ScanFace, ClipboardCheck, Rocket] as const;
const REQUIREMENT_ICONS = [IdCard, ScanFace, Landmark, FileCheck2] as const;

export default async function StartPage() {
  const [session, dict] = await Promise.all([auth(), getDictionary()]);
  const t = dict.start;
  const role = session?.user?.role;

  // The gate adapts to who's here. Admins are staff (not fundraisers); verified
  // owners already are fundraisers; donors continue verification; guests
  // register or sign in.
  let primary: { href: string; label: string };
  let secondary: { href: string; label: string };
  let intro: string;
  if (role === "ADMIN") {
    primary = { href: "/admin", label: t.goAdmin };
    secondary = { href: "/campaigns", label: t.browse };
    intro = t.introAdmin;
  } else if (role === "OWNER") {
    primary = { href: "/dashboard", label: t.goDashboard };
    secondary = { href: "/campaigns", label: t.browse };
    intro = t.introOwner;
  } else if (session?.user) {
    primary = { href: "/start/verify", label: t.continueVerification };
    secondary = { href: "/dashboard", label: t.yourDashboard };
    intro = t.introDonor;
  } else {
    primary = { href: "/register?next=/start/verify", label: t.registerFundraiser };
    secondary = { href: "/login", label: t.signIn };
    intro = t.introGuest;
  }

  return (
    <div>
      {/* Hero — the fundraiser gate */}
      <section className="border-b bg-[radial-gradient(ellipse_at_top,color-mix(in_oklab,var(--primary)_9%,transparent)_0%,transparent_60%)]">
        <div className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6 sm:py-28">
          <Badge variant="gold" className="mb-6">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
            {t.badge}
          </Badge>
          <h1 className="mx-auto max-w-3xl font-display text-4xl font-bold tracking-tight sm:text-5xl">
            {t.title}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-muted-foreground sm:text-lg">
            {intro}
          </p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href={secondary.href}>{secondary.label}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Steps */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {t.howTitle}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-muted-foreground">
          {t.howSub}
        </p>
        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {t.steps.map((step, i) => {
            const Icon = STEP_ICONS[i];
            return (
              <li key={step.title} className="relative rounded-lg border bg-card p-6 shadow-sm">
                <span className="absolute right-5 top-5 font-display text-2xl font-bold text-muted-foreground/20">
                  {i + 1}
                </span>
                <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <h3 className="font-display text-base font-semibold">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </li>
            );
          })}
        </ol>
      </section>

      {/* Requirements */}
      <section className="border-t bg-card">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                {t.needTitle}
              </h2>
              <p className="mt-3 text-muted-foreground">{t.needDesc}</p>
              <div className="mt-5 flex items-center gap-2 text-sm text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-success" aria-hidden />
                {t.needPrivate}
              </div>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {t.requirements.map((label, i) => {
                const Icon = REQUIREMENT_ICONS[i];
                return (
                  <li key={label} className="flex items-center gap-3 rounded-lg border p-4">
                    <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <span className="text-sm font-medium">{label}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-12 flex flex-col items-center gap-4 rounded-xl border bg-background p-8 text-center">
            <h3 className="font-display text-xl font-semibold">{t.readyTitle}</h3>
            <p className="max-w-lg text-sm text-muted-foreground">{t.readyDesc}</p>
            <Button asChild size="lg">
              <Link href={primary.href}>{primary.label}</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

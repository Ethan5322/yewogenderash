import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock, ShieldQuestion, Megaphone, Landmark, Settings, MessageSquare } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { BalanceSummary } from "@/components/dashboard/balance-summary";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";
import { getDictionary } from "@/lib/i18n";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // Server-side guard — the proxy is the outer gate, never the only one.
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      verificationStatus: true,
      ownerProfile: { select: { id: true, authorCode: true } },
    },
  });

  const t = (await getDictionary()).dashboard.home;
  const status = user?.verificationStatus ?? "UNVERIFIED";
  const isOwner = status === "VERIFIED" && !!user?.ownerProfile;
  const authorCode = user?.ownerProfile?.authorCode ?? null;
  const inReview = status === "PENDING";

  const statusBadge = isOwner
    ? { icon: BadgeCheck, label: t.verified, cls: "bg-success/15 text-success" }
    : inReview
      ? { icon: Clock, label: t.inReview, cls: "bg-warning/15 text-warning" }
      : { icon: ShieldQuestion, label: t.notOwner, cls: "bg-muted text-muted-foreground" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <DashboardNav />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              {t.welcome}, {session.user.name ?? ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {t.subtitle}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusBadge.cls}`}
          >
            <statusBadge.icon className="h-4 w-4" aria-hidden />
            {statusBadge.label}
          </span>
        </div>

        {/* Money first — it is what a fundraiser signs in to see. */}
        {user?.ownerProfile ? <BalanceSummary ownerId={user.ownerProfile.id} /> : null}

        {/* Onboarding prompt for anyone not yet a verified owner */}
        {!isOwner ? (
          <Card className="mt-8 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">
                {inReview
                  ? t.reviewTitle
                  : t.becomeTitle}
              </CardTitle>
              <CardDescription>
                {inReview
                  ? t.reviewBody
                  : t.becomeBody}
              </CardDescription>
            </CardHeader>
            {!inReview ? (
              <CardContent>
                <Button asChild>
                  <Link href="/start/verify">{t.continueVerification}</Link>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {/* Fundraiser ID (verified owners) */}
        {isOwner && authorCode ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-base">{t.idTitle}</CardTitle>
              <CardDescription>
                Your official corporate ID card · verification code{" "}
                <span className="font-mono font-medium">{authorCode}</span>. Add
                your photo, print the card, or let an admin scan the QR to confirm
                your identity.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
              <img
                src={`/a/${authorCode}/qr`}
                alt="Your fundraiser verification QR"
                width={80}
                height={80}
                className="rounded border bg-white p-1"
              />
              <Button asChild size="sm">
                <Link href="/dashboard/id">{t.openId}</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/a/${authorCode}`}>{t.publicProfile}</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Owner tools */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DashCard
            icon={Megaphone}
            title={t.cardCampaigns}
            description={
              isOwner
                ? t.cardCampaignsDesc
                : t.cardLocked
            }
            href="/dashboard/campaigns"
            cta={t.openCampaigns}
            disabled={!isOwner}
          />
          <DashCard
            icon={Landmark}
            title={t.cardPayouts}
            description={t.cardPayoutsDesc}
            href="/dashboard/payouts"
            cta={t.viewPayouts}
            disabled={!isOwner}
          />
          <DashCard
            icon={MessageSquare}
            title={t.cardMessages}
            description={t.cardMessagesDesc}
            href="/dashboard/messages"
            cta={t.openMessages}
            disabled={false}
          />
          <DashCard
            icon={Settings}
            title={t.cardSettings}
            description={t.cardSettingsDesc}
            href="/dashboard/settings"
            cta={t.openSettings}
            disabled={false}
          />
        </div>
      </main>
      <DashboardFooter />
    </div>
  );
}

function DashCard({
  icon: Icon,
  title,
  description,
  href,
  cta,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
  href: string;
  cta: string;
  disabled: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {disabled ? (
          <Button size="sm" variant="outline" disabled>
            {cta}
          </Button>
        ) : (
          <Button asChild size="sm">
            <Link href={href}>{cta}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { BadgeCheck, Clock, ShieldQuestion, Megaphone, Landmark, Settings, MessageSquare } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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

  const status = user?.verificationStatus ?? "UNVERIFIED";
  const isOwner = status === "VERIFIED" && !!user?.ownerProfile;
  const authorCode = user?.ownerProfile?.authorCode ?? null;
  const inReview = status === "PENDING";

  const statusBadge = isOwner
    ? { icon: BadgeCheck, label: "Verified owner", cls: "bg-success/15 text-success" }
    : inReview
      ? { icon: Clock, label: "Verification in review", cls: "bg-warning/15 text-warning" }
      : { icon: ShieldQuestion, label: "Not yet a verified owner", cls: "bg-muted text-muted-foreground" };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              Welcome, {session.user.name ?? "there"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Your campaign owner workspace.
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${statusBadge.cls}`}
          >
            <statusBadge.icon className="h-4 w-4" aria-hidden />
            {statusBadge.label}
          </span>
        </div>

        {/* Onboarding prompt for anyone not yet a verified owner */}
        {!isOwner ? (
          <Card className="mt-8 border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-base">
                {inReview
                  ? "Your verification is being reviewed"
                  : "Become a verified campaign owner"}
              </CardTitle>
              <CardDescription>
                {inReview
                  ? "Our team is reviewing your identity documents. You'll be able to create campaigns as soon as you're approved."
                  : "To raise funds, complete identity verification — ID upload and a live face capture. Once approved, you can create campaigns with their own QR code and separated ledger."}
              </CardDescription>
            </CardHeader>
            {!inReview ? (
              <CardContent>
                <Button asChild>
                  <Link href="/start/verify">Continue owner verification</Link>
                </Button>
              </CardContent>
            ) : null}
          </Card>
        ) : null}

        {/* Fundraiser ID (verified owners) */}
        {isOwner && authorCode ? (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="text-base">Your Fundraiser ID</CardTitle>
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
                <Link href="/dashboard/id">Open my Fundraiser ID</Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/a/${authorCode}`}>Public profile</Link>
              </Button>
            </CardContent>
          </Card>
        ) : null}

        {/* Owner tools */}
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <DashCard
            icon={Megaphone}
            title="My campaigns"
            description={
              isOwner
                ? "Create and manage your campaigns, QR codes, and updates."
                : "Available once you're a verified owner."
            }
            href="/dashboard/campaigns"
            cta="Open campaigns"
            disabled={!isOwner}
          />
          <DashCard
            icon={Landmark}
            title="Payouts"
            description="Request and track payouts from your campaign balances."
            href="/dashboard/payouts"
            cta="View payouts"
            disabled={!isOwner}
          />
          <DashCard
            icon={MessageSquare}
            title="Messages"
            description="Message the Yewogen Derash team and read their notices."
            href="/dashboard/messages"
            cta="Open messages"
            disabled={false}
          />
          <DashCard
            icon={Settings}
            title="Settings"
            description="Notification preferences and your account details."
            href="/dashboard/settings"
            cta="Open settings"
            disabled={false}
          />
        </div>
      </main>
      <SiteFooter />
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

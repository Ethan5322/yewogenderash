import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck, Rocket, Share2, QrCode } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { IdPhotoUpload } from "@/components/owner/id-photo-upload";
import { CopyButton } from "@/components/admin/copy-button";
import { formatDate } from "@/lib/format";

export const metadata = { title: "My Fundraiser ID" };

export default async function FundraiserIdPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/id");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: {
      authorCode: true,
      verifiedAt: true,
      mulesooVerified: true,
      idPhotoUrl: true,
      createdAt: true,
      user: { select: { name: true, verificationStatus: true } },
      // The querycode that goes on the ID — prefer an ACTIVE campaign, else the
      // most recent one the owner created.
      campaigns: {
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 5,
        select: { queryCode: true, slug: true, status: true, title: true },
      },
    },
  });

  if (!owner) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={session.user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Fundraiser ID</h1>
          <p className="mt-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Begin owner verification to be issued your Fundraiser ID.{" "}
            <Link href="/start" className="text-primary hover:underline">Get started</Link>.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const verified = owner.mulesooVerified && !!owner.authorCode;
  // Prefer an active campaign so the QR resolves to a live donor page.
  const campaign =
    owner.campaigns.find((c) => c.status === "ACTIVE") ?? owner.campaigns[0] ?? null;

  // The ID unlocks only once the owner has a campaign — its querycode lives on
  // the card, so scanning it opens that campaign's donor page.
  const approved = verified && !!campaign;
  const code = owner.authorCode ?? "PENDING-REVIEW";
  const donateUrl = campaign ? `${appUrl()}/q/${campaign.queryCode}` : undefined;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          My Fundraiser ID
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your official verification card carries your campaign&apos;s querycode —
          anyone who scans it opens your donation page. It unlocks once you have a
          campaign.
        </p>

        {/* Verified but no campaign yet → the ID stays locked until one exists */}
        {verified && !campaign ? (
          <div className="mt-6 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" aria-hidden />
              <p className="font-semibold">You&apos;re verified! One step left.</p>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first campaign to unlock your Fundraiser ID. Your ID
              carries that campaign&apos;s querycode, so the QR on it opens your
              donation page directly.
            </p>
            <Link
              href="/dashboard/campaigns/new"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              <Rocket className="h-4 w-4" aria-hidden /> Create your campaign
            </Link>
          </div>
        ) : null}

        {/* The card (masked until verified AND a campaign exists) */}
        <div className="mt-8 flex justify-center">
          <FundraiserIdCard
            name={owner.user.name}
            verificationCode={code}
            issued={owner.verifiedAt ? formatDate(owner.verifiedAt) : "—"}
            status={approved ? "VERIFIED" : "PENDING"}
            photoUrl={owner.idPhotoUrl}
            approved={approved}
            showDownload
            qrUrl={donateUrl}
            fields={[
              campaign
                ? { label: "Querycode", value: campaign.queryCode }
                : { label: "Status", value: verified ? "Verified" : "Pending" },
              { label: "Member since", value: formatDate(owner.createdAt) },
              { label: "Platform", value: "Yewogen Derash" },
            ]}
          />
        </div>

        {/* Share block — the donation link the QR encodes (approved owners) */}
        {approved && campaign && donateUrl ? (
          <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-base font-semibold">Share your donation link</h2>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Post this anywhere — WhatsApp, Telegram, social media, posters. One
              tap opens your donation page; no other campaign is shown.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border bg-background px-3 py-2 text-sm">
                {donateUrl}
              </code>
              <CopyButton value={donateUrl} label="Copy link" />
              <Link
                href={`/q/${campaign.queryCode}`}
                target="_blank"
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
              </Link>
              <Link
                href={`/q/${campaign.queryCode}/qr?download=1`}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
              >
                <QrCode className="h-3.5 w-3.5" aria-hidden /> QR PNG
              </Link>
            </div>
            {campaign.status !== "ACTIVE" ? (
              <p className="mt-2 text-xs text-warning">
                “{campaign.title}” isn&apos;t live yet — the link starts working once
                an admin approves it.
              </p>
            ) : null}
          </section>
        ) : null}

        {/* Photo management */}
        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-base font-semibold">ID photo</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a clear photo of your face from your gallery. It is
            auto-cropped and placed on your ID. This is separate from the private
            verification selfie only your reviewer sees.
          </p>
          <div className="mt-4">
            <IdPhotoUpload hasPhoto={!!owner.idPhotoUrl} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

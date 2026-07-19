import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, ExternalLink, QrCode, Megaphone, Download } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { SubmitCampaignButton } from "@/components/campaigns/submit-campaign-button";
import { formatETB, progressPercent, formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "My campaigns" };

export default async function MyCampaignsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/campaigns");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      ownerProfile: {
        include: {
          campaigns: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              title: true,
              slug: true,
              status: true,
              category: true,
              targetAmount: true,
              currentAmount: true,
              currency: true,
              queryCode: true,
              reviewNote: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });
  if (!user) redirect("/login?callbackUrl=/dashboard/campaigns");

  const isVerified = user.verificationStatus === "VERIFIED" && !!user.ownerProfile;
  const campaigns = user.ownerProfile?.campaigns ?? [];

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">
              My campaigns
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Only you and platform administrators can see this list.
            </p>
          </div>
          {isVerified ? (
            <Button asChild>
              <Link href="/dashboard/campaigns/new">
                <Plus className="h-4 w-4" aria-hidden /> New campaign
              </Link>
            </Button>
          ) : null}
        </div>

        {!isVerified ? (
          <div className="mt-10 rounded-xl border border-dashed p-10 text-center">
            <h2 className="font-display text-lg font-semibold">
              Verification required
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Campaigns can only be created by identity-verified owners. Complete
              owner verification to get started.
            </p>
            <Button asChild className="mt-6">
              <Link href="/start">Begin verification</Link>
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="mt-10 flex flex-col items-center rounded-xl border border-dashed p-12 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground" aria-hidden />
            <h2 className="mt-4 font-display text-lg font-semibold">
              No campaigns yet
            </h2>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Create your first campaign. It starts as a draft, goes through
              admin review, and receives its own querycode and QR.
            </p>
            <Button asChild className="mt-6">
              <Link href="/dashboard/campaigns/new">
                <Plus className="h-4 w-4" aria-hidden /> Create a campaign
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 space-y-4">
            {campaigns.map((c) => {
              const pct = progressPercent(
                Number(c.currentAmount),
                Number(c.targetAmount)
              );
              return (
                <li key={c.id} className="rounded-xl border bg-card p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-display text-base font-semibold">
                          {c.title}
                        </h2>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Created {formatDate(c.createdAt)}</span>
                        <span aria-hidden>·</span>
                        <span className="inline-flex items-center gap-1 font-mono">
                          <QrCode className="h-3.5 w-3.5" aria-hidden />
                          {c.queryCode}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {(c.status === "DRAFT" || c.status === "REJECTED") && (
                        <SubmitCampaignButton campaignId={c.id} />
                      )}
                      {(c.status === "ACTIVE" || c.status === "COMPLETED") && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/campaigns/${c.slug}`}>
                            View public page{" "}
                            <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                          </Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {c.status === "REJECTED" && c.reviewNote ? (
                    <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
                      <span className="font-medium">Reviewer note:</span>{" "}
                      {c.reviewNote}
                    </p>
                  ) : null}

                  <div className="mt-4 flex flex-wrap items-end gap-6">
                    <div className="min-w-0 flex-1">
                      <ProgressBar value={pct} label={`${pct}% funded`} />
                      <div className="mt-2 flex items-baseline justify-between text-sm">
                        <span className="font-semibold">
                          {formatETB(Number(c.currentAmount), c.currency)}
                        </span>
                        <span className="text-muted-foreground">
                          of {formatETB(Number(c.targetAmount), c.currency)} · {pct}%
                        </span>
                      </div>
                    </div>
                    {/* Campaign QR — fixed at creation, exportable for posters */}
                    <div className="flex items-center gap-3 rounded-lg border p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
                      <img
                        src={`/q/${c.queryCode}/qr`}
                        alt={`QR code for querycode ${c.queryCode}`}
                        width={72}
                        height={72}
                        className="h-18 w-18 rounded"
                      />
                      <a
                        href={`/q/${c.queryCode}/qr`}
                        download={`yewogen-${c.queryCode}.png`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden />
                        Download QR
                      </a>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

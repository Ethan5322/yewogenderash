import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import {
  ArrowLeft,
  ExternalLink,
  Download,
  Lock,
  HandCoins,
  Target,
  TrendingUp,
  Megaphone,
} from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { PostUpdateForm } from "@/components/dashboard/post-update-form";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { formatETB, formatDate, progressPercent } from "@/lib/format";

export const metadata = { title: "Campaign details" };

export default async function OwnerCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=/dashboard/campaigns/${id}`);
  }

  // Ownership scope: an owner can only ever load a campaign that is theirs.
  const campaign = await db.campaign.findFirst({
    where: { id, owner: { userId: session.user.id } },
    include: {
      _count: { select: { donations: { where: { status: "SUCCESS" } } } },
      donations: {
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          donorName: true,
          txRef: true,
          paidAt: true,
          createdAt: true,
        },
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          payoutReference: true,
          createdAt: true,
        },
      },
      updates: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, body: true, createdAt: true },
      },
    },
  });
  if (!campaign) notFound();

  const canPostUpdates =
    campaign.status === "ACTIVE" || campaign.status === "COMPLETED";

  const pct = progressPercent(
    Number(campaign.currentAmount),
    Number(campaign.targetAmount)
  );
  const isLive = campaign.status === "ACTIVE" || campaign.status === "COMPLETED";

  const stats = [
    {
      icon: HandCoins,
      label: "Raised (confirmed)",
      value: formatETB(Number(campaign.currentAmount), campaign.currency),
      sub: `${campaign._count.donations} donations`,
    },
    {
      icon: Target,
      label: "Target",
      value: formatETB(Number(campaign.targetAmount), campaign.currency),
      sub: CATEGORY_LABELS[campaign.category],
    },
    {
      icon: TrendingUp,
      label: "Progress",
      value: `${pct}%`,
      sub: "of target",
    },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> My campaigns
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {campaign.title}
          </h1>
          <StatusBadge status={campaign.status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {CATEGORY_LABELS[campaign.category]} · querycode{" "}
          <span className="font-mono">{campaign.queryCode}</span> · created{" "}
          {formatDate(campaign.createdAt)}
          {isLive ? (
            <>
              {" · "}
              <Link
                href={`/campaigns/${campaign.slug}`}
                className="inline-flex items-center gap-0.5 text-primary hover:underline"
              >
                public page <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            </>
          ) : null}
        </p>

        {/* Read-only authority note */}
        <div className="mt-6 flex items-start gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-muted-foreground">
            This is a read-only view of your campaign and its donations. For
            trust and safety, only platform administrators can edit a campaign or
            change its status or funds. To request a change, reach us via{" "}
            <Link href="/support/contact" className="text-primary hover:underline">
              support
            </Link>
            .
          </p>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <s.icon className="h-4 w-4" aria-hidden /> {s.label}
              </div>
              <p className="mt-2 font-display text-xl font-bold">{s.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <ProgressBar value={pct} label={`${pct}% funded`} />
        </div>

        {/* Donation ledger */}
        <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">
            Donations{" "}
            <span className="text-sm font-normal text-muted-foreground">
              (latest {Math.min(100, campaign.donations.length)})
            </span>
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every donation to this campaign. Only confirmed (SUCCESS) donations
            count toward your total.
          </p>
          {campaign.donations.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              No donations yet. Share your querycode or QR to start receiving
              support.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Date</th>
                    <th className="py-2 pr-3 font-medium">Donor</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 font-medium">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {campaign.donations.map((d) => (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                        {formatDate(d.paidAt ?? d.createdAt)}
                      </td>
                      <td className="py-2 pr-3">{d.donorName ?? "Anonymous"}</td>
                      <td className="py-2 pr-3 whitespace-nowrap font-medium">
                        {formatETB(Number(d.amount), d.currency)}
                      </td>
                      <td className="py-2 pr-3 text-xs font-semibold">
                        {d.status}
                      </td>
                      <td className="py-2 font-mono text-xs text-muted-foreground">
                        {d.txRef}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Campaign updates */}
        <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
            <h2 className="font-display text-base font-semibold">Updates</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Post progress so your donors stay informed. Updates appear on your
            public campaign page.
          </p>

          {canPostUpdates ? (
            <div className="mt-4">
              <PostUpdateForm campaignId={campaign.id} />
            </div>
          ) : (
            <p className="mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              You can post updates once this campaign is live (approved).
            </p>
          )}

          {campaign.updates.length > 0 ? (
            <ol className="mt-6 space-y-5 border-l pl-6">
              {campaign.updates.map((u) => (
                <li key={u.id} className="relative">
                  <span
                    className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                    aria-hidden
                  />
                  <time className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {formatDate(u.createdAt)}
                  </time>
                  <h3 className="mt-1 font-semibold">{u.title}</h3>
                  <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                    {u.body}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </section>

        {/* Payouts + QR */}
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-xl border bg-card p-6 shadow-sm lg:col-span-2">
            <h2 className="font-display text-base font-semibold">Payouts</h2>
            {campaign.payouts.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">
                No payouts yet. Request one from your{" "}
                <Link href="/dashboard/payouts" className="text-primary hover:underline">
                  payouts page
                </Link>{" "}
                — every payout is admin-approved.
              </p>
            ) : (
              <ul className="mt-3 space-y-1.5 text-sm">
                {campaign.payouts.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {formatDate(p.createdAt)}
                      {p.payoutReference ? ` · ${p.payoutReference}` : ""}
                    </span>
                    <span>
                      <span className="font-medium">
                        {formatETB(Number(p.amount), p.currency)}
                      </span>{" "}
                      <span className="text-xs font-semibold">{p.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border bg-card p-6 text-center shadow-sm">
            <h2 className="font-display text-base font-semibold">Campaign QR</h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
            <img
              src={`/q/${campaign.queryCode}/qr`}
              alt={`QR code for querycode ${campaign.queryCode}`}
              width={140}
              height={140}
              className="mx-auto mt-3 rounded"
            />
            <a
              href={`/q/${campaign.queryCode}/qr`}
              download={`yewogen-${campaign.queryCode}.png`}
              className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              <Download className="h-4 w-4" aria-hidden /> Download QR
            </a>
          </section>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

import Link from "next/link";
import {
  Megaphone,
  BadgeCheck,
  HandCoins,
  Landmark,
  Percent,
  Flag,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatETB } from "@/lib/format";
import { adminUnreadTotal } from "@/lib/messages";
import { getAdminAnalytics } from "@/lib/analytics";
import {
  DonationsTrendChart,
  CampaignsByStatusChart,
} from "@/components/admin/analytics-charts";

export const metadata = { title: "Admin · Overview" };

export default async function AdminOverviewPage() {
  const [
    totalCampaigns,
    activeCampaigns,
    pendingCampaigns,
    verifiedOwners,
    pendingOwners,
    donationAgg,
    payoutAgg,
    feeAgg,
    flaggedCampaigns,
    flaggedOwners,
  ] = await Promise.all([
    db.campaign.count(),
    db.campaign.count({ where: { status: "ACTIVE" } }),
    db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.user.count({ where: { verificationStatus: "VERIFIED", ownerProfile: { isNot: null } } }),
    db.user.count({ where: { verificationStatus: "PENDING" } }),
    db.donation.aggregate({
      where: { status: "SUCCESS" },
      _count: true,
      _sum: { amount: true },
    }),
    db.payout.aggregate({
      where: { status: "PAID" },
      _sum: { amount: true },
    }),
    db.feeLedger.aggregate({
      _sum: { feeAmount: true, netAmount: true },
    }),
    db.campaign.count({ where: { flagged: true } }),
    db.campaignOwner.count({ where: { flagged: true } }),
  ]);

  const [pendingPayouts, unreadMessages, openReports, rejectedKyc] = await Promise.all([
    db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    adminUnreadTotal(),
    db.supportMessage.count({ where: { type: "REPORT", status: "OPEN" } }),
    db.user.count({ where: { verificationStatus: "REJECTED" } }),
  ]);

  // Everything that needs a human decision, surfaced up top.
  const actions = [
    { label: "KYC applications to review", count: pendingOwners, href: "/admin/owners" },
    { label: "Campaigns awaiting approval", count: pendingCampaigns, href: "/admin/campaigns?status=PENDING_REVIEW" },
    { label: "Payouts to release", count: pendingPayouts, href: "/admin/payouts" },
    { label: "Unread fundraiser messages", count: unreadMessages, href: "/admin/messages" },
    { label: "Open abuse reports", count: openReports, href: "/admin/support?f=REPORT" },
    { label: "Fraud flags open", count: flaggedCampaigns + flaggedOwners, href: "/admin/campaigns" },
    { label: "Failed verifications", count: rejectedKyc, href: "/admin/owners" },
  ].filter((a) => a.count > 0);

  const { donationsByDay, campaignsByStatus } = await getAdminAnalytics(30);

  const stats = [
    {
      icon: Megaphone,
      label: "Campaigns",
      value: String(totalCampaigns),
      sub: `${activeCampaigns} active`,
    },
    {
      icon: BadgeCheck,
      label: "Verified owners",
      value: String(verifiedOwners),
      sub: `${pendingOwners} awaiting KYC review`,
    },
    {
      icon: HandCoins,
      label: "Donations",
      value: String(donationAgg._count),
      sub: `${formatETB(Number(donationAgg._sum.amount ?? 0))} raised`,
    },
    {
      icon: Landmark,
      label: "Paid out",
      value: formatETB(Number(payoutAgg._sum.amount ?? 0)),
      sub: "admin-approved payouts",
    },
    {
      icon: Percent,
      label: "Platform fees",
      value: formatETB(Number(feeAgg._sum.feeAmount ?? 0)),
      sub: `${formatETB(Number(feeAgg._sum.netAmount ?? 0))} net to campaigns`,
    },
    {
      icon: Flag,
      label: "Fraud flags",
      value: String(flaggedCampaigns + flaggedOwners),
      sub: `${flaggedCampaigns} campaigns · ${flaggedOwners} owners`,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>

      {/* Action required — everything needing a human decision */}
      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="text-sm font-semibold">Action required</h2>
        {actions.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> All clear — nothing
            awaiting review.
          </p>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => (
              <Link
                key={a.label}
                href={a.href}
                className="group flex items-center justify-between rounded-lg border bg-background p-3 transition-colors hover:border-primary/40"
              >
                <span className="text-sm">{a.label}</span>
                <span className="flex items-center gap-2">
                  <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground">
                    {a.count}
                  </span>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <s.icon className="h-4 w-4" aria-hidden />
              {s.label}
            </div>
            <p className="mt-2 font-display text-2xl font-bold">{s.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Donations raised</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Successful donations per day, last 30 days (ETB)
          </p>
          <DonationsTrendChart data={donationsByDay} />
        </section>

        <section className="rounded-xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold">Campaigns by status</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Every campaign across its lifecycle states
          </p>
          <CampaignsByStatusChart data={campaignsByStatus} />
        </section>
      </div>

    </div>
  );
}

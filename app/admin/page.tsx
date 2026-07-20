import Link from "next/link";
import {
  Megaphone,
  BadgeCheck,
  HandCoins,
  Landmark,
  ClipboardList,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { formatETB } from "@/lib/format";
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
  ]);

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
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Overview</h1>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/campaigns?status=PENDING_REVIEW"
          className="group flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-warning/15 text-warning">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">Campaign review queue</p>
              <p className="text-sm text-muted-foreground">
                {pendingCampaigns} awaiting decision
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>

        <Link
          href="/admin/campaigns"
          className="group flex items-center justify-between rounded-xl border bg-card p-5 shadow-sm transition-colors hover:border-primary/40"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <Megaphone className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <p className="font-medium">All campaigns</p>
              <p className="text-sm text-muted-foreground">
                Full list with filters and decisions
              </p>
            </div>
          </div>
          <ArrowRight
            className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </div>
  );
}

import Link from "next/link";
import {
  Megaphone,
  Rocket,
  Clock,
  Users,
  BadgeCheck,
  HandCoins,
  Landmark,
  Percent,
  Flag,
  XCircle,
  Undo2,
  ArrowRight,
  CheckCircle2,
  Download,
  ListChecks,
  ScrollText,
} from "lucide-react";
import { db } from "@/lib/db";
import { currentAdmin, hasPermission } from "@/lib/admin/permissions";
import { formatETB, formatDateTime } from "@/lib/format";
import { adminUnreadTotal } from "@/lib/messages";
import { getAdminAnalytics, getBreakdownAnalytics } from "@/lib/analytics";
import {
  DonationsTrendChart,
  CampaignsByStatusChart,
  BreakdownBarChart,
} from "@/components/admin/analytics-charts";
import { DashboardToolbar } from "@/components/admin/dashboard-toolbar";
import {
  PageHeader,
  KpiCard,
  SectionCard,
  ToolbarLink,
} from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Dashboard" };

const RANGES = [7, 30, 90] as const;

function auditLabel(action: string) {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawRange = Number(typeof sp.range === "string" ? sp.range : 30);
  const range = (RANGES as readonly number[]).includes(rawRange) ? rawRange : 30;

  // The dashboard is the one page every admin lands on, so it must show only
  // what this admin is authorised for. Without this a support or KYC sub-admin
  // saw platform revenue, fees, payouts and donor counts on their home screen.
  const me = await currentAdmin();
  const canFinance = hasPermission(me, "payouts");
  const canCampaigns = hasPermission(me, "campaigns");
  const canKyc = hasPermission(me, "kyc");
  const canMessages = hasPermission(me, "messages");
  const canAudit = hasPermission(me, "audit");

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
    pendingPayouts,
    unreadMessages,
    openReports,
    rejectedKyc,
    failedPayments,
    pendingRefunds,
    donorGroups,
    recentActivity,
    analytics,
    breakdown,
  ] = await Promise.all([
    db.campaign.count(),
    db.campaign.count({ where: { status: "ACTIVE" } }),
    db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
    db.user.count({ where: { verificationStatus: "VERIFIED", ownerProfile: { isNot: null } } }),
    db.user.count({ where: { verificationStatus: "PENDING", ownerProfile: { isNot: null } } }),
    db.donation.aggregate({ where: { status: "SUCCESS" }, _count: true, _sum: { amount: true } }),
    db.payout.aggregate({ where: { status: "PAID" }, _sum: { amount: true } }),
    db.feeLedger.aggregate({ _sum: { feeAmount: true, netAmount: true } }),
    db.campaign.count({ where: { flagged: true } }),
    db.campaignOwner.count({ where: { flagged: true } }),
    db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
    adminUnreadTotal(),
    db.supportMessage.count({ where: { type: "REPORT", status: "OPEN" } }),
    db.user.count({ where: { verificationStatus: "REJECTED" } }),
    db.donation.count({ where: { status: "FAILED" } }),
    db.donation.count({ where: { status: "DISPUTED" } }),
    db.donation.groupBy({ by: ["donorName"], where: { status: "SUCCESS" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true, action: true, entityType: true, createdAt: true,
        actor: { select: { name: true } },
      },
    }),
    getAdminAnalytics(range),
    getBreakdownAnalytics(),
  ]);

  const { donationsByDay, payoutsByDay, campaignsByStatus } = analytics;
  const totalDonors = donorGroups.length;
  const flags = flaggedCampaigns + flaggedOwners;

  // Everything that needs a human decision, surfaced up top. `show` keeps a
  // queue off the board unless this admin can actually action it — a tile that
  // only bounces to ?denied= is worse than no tile.
  const actions = [
    { label: "KYC applications to review", count: pendingOwners, href: "/admin/owners", show: canKyc },
    { label: "Campaigns awaiting approval", count: pendingCampaigns, href: "/admin/campaigns?status=PENDING_REVIEW", show: canCampaigns },
    { label: "Payouts to release", count: pendingPayouts, href: "/admin/payouts", show: canFinance },
    { label: "Unread fundraiser messages", count: unreadMessages, href: "/admin/messages", show: canMessages },
    { label: "Open abuse reports", count: openReports, href: "/admin/support?f=REPORT", show: canMessages },
    { label: "Fraud flags open", count: flags, href: "/admin/campaigns", show: canCampaigns || canKyc },
    { label: "Failed verifications", count: rejectedKyc, href: "/admin/owners", show: canKyc },
    { label: "Disputes / pending refunds", count: pendingRefunds, href: "/admin/donations?status=DISPUTED", show: canFinance },
  ]
    .filter((a) => a.count > 0 && a.show)
    .map(({ label, count, href }) => ({ label, count, href }));

  const kpis = [
    { label: "Campaigns", value: String(totalCampaigns), sub: `${activeCampaigns} active`, icon: Megaphone, tone: "neutral" as const, href: "/admin/campaigns", show: canCampaigns },
    { label: "Active", value: String(activeCampaigns), sub: "live & public", icon: Rocket, tone: "success" as const, href: "/admin/campaigns?status=ACTIVE", show: canCampaigns },
    { label: "Pending approvals", value: String(pendingCampaigns), sub: "awaiting review", icon: Clock, tone: pendingCampaigns > 0 ? "warning" as const : "neutral" as const, href: "/admin/campaigns?status=PENDING_REVIEW", show: canCampaigns },
    { label: "Donors", value: totalDonors.toLocaleString(), sub: "unique givers", icon: Users, tone: "info" as const, show: canFinance },
    { label: "Verified owners", value: String(verifiedOwners), sub: `${pendingOwners} in KYC queue`, icon: BadgeCheck, tone: "success" as const, href: "/admin/owners", show: canKyc },
    { label: "Donations", value: String(donationAgg._count), sub: `${formatETB(Number(donationAgg._sum.amount ?? 0))} raised`, icon: HandCoins, tone: "brand" as const, href: "/admin/donations", show: canFinance },
    { label: "Paid out", value: formatETB(Number(payoutAgg._sum.amount ?? 0)), sub: "released to owners", icon: Landmark, tone: "info" as const, href: "/admin/payouts", show: canFinance },
    { label: "Platform fees", value: formatETB(Number(feeAgg._sum.feeAmount ?? 0)), sub: "collected", icon: Percent, tone: "brand" as const, show: canFinance },
    { label: "Suspicious flags", value: String(flags), sub: `${flaggedCampaigns} campaigns · ${flaggedOwners} owners`, icon: Flag, tone: flags > 0 ? "danger" as const : "neutral" as const, href: "/admin/campaigns", show: canCampaigns || canKyc },
    { label: "Failed payments", value: String(failedPayments), sub: "gateway failures", icon: XCircle, tone: "neutral" as const, href: "/admin/donations?status=FAILED", show: canFinance },
    { label: "Pending refunds", value: String(pendingRefunds), sub: "disputes open", icon: Undo2, tone: pendingRefunds > 0 ? "warning" as const : "neutral" as const, href: "/admin/donations?status=DISPUTED", show: canFinance },
  ]
    .filter((k) => k.show)
    .map(({ show: _show, ...k }) => k);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live operational overview of the platform."
        actions={
          <>
            <div className="hidden items-center rounded-md border border-input bg-background p-0.5 shadow-sm sm:flex">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/admin?range=${r}`}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}d
                </Link>
              ))}
            </div>
            {/* Both of these lead to capability-gated destinations — only offer
                them to an admin who can actually open them. */}
            {canKyc ? (
              <ToolbarLink href="/admin/owners" icon={ListChecks}>Review queue</ToolbarLink>
            ) : null}
            {canFinance ? (
              <a
                href="/admin/donations/export?status=ALL"
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
              >
                <Download className="h-4 w-4" aria-hidden /> Export CSV
              </a>
            ) : null}
            <DashboardToolbar />
          </>
        }
      />

      {/* Action required */}
      <SectionCard title="Action required" className="mb-6">
        {actions.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden /> All clear — nothing awaiting review.
          </p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
      </SectionCard>

      {/* KPI grid */}
      {kpis.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {kpis.map((k) => (
            <KpiCard key={k.label} {...k} />
          ))}
        </div>
      ) : (
        <SectionCard title="Your workspace">
          <p className="text-sm text-muted-foreground">
            Platform statistics aren&apos;t part of your role. Use the sidebar to
            open the sections you&apos;re responsible for — your queues and any
            items awaiting you appear under “Action required” above.
          </p>
        </SectionCard>
      )}

      {/* Trends — money, so finance capability only */}
      {canFinance ? (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <SectionCard title="Donations raised" sub={`Successful donations per day · last ${range} days (ETB)`}>
            <DonationsTrendChart data={donationsByDay} />
          </SectionCard>
          <SectionCard title="Payouts released" sub={`Paid payouts per day · last ${range} days (ETB)`}>
            <DonationsTrendChart data={payoutsByDay} />
          </SectionCard>
        </div>
      ) : null}

      {/* Campaign status + recent activity */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {canCampaigns ? (
          <SectionCard
            title="Campaigns by status"
            sub="Across the lifecycle"
            className={canAudit ? "lg:col-span-2" : "lg:col-span-3"}
          >
            <CampaignsByStatusChart data={campaignsByStatus} />
          </SectionCard>
        ) : null}
        {/* The audit trail is a governance view — not every delegated admin. */}
        {canAudit ? (
        <SectionCard
          title="Recent activity"
          className={canCampaigns ? undefined : "lg:col-span-3"}
          actions={
            <Link href="/admin/audit" className="text-xs font-medium text-primary hover:underline">View all</Link>
          }
        >
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentActivity.map((a) => (
                <li key={a.id} className="flex items-start gap-2.5 text-sm">
                  <ScrollText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="truncate font-medium">{auditLabel(a.action)}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.actor?.name ?? "System"} · {formatDateTime(a.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        ) : null}
      </div>

      {/* Full analytics suite (§12.8) — each panel behind its own capability */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {canFinance ? (
          <SectionCard title="Category performance" sub="Raised by campaign category (ETB)">
            <BreakdownBarChart data={breakdown.categoryPerformance} money />
          </SectionCard>
        ) : null}
        {canKyc ? (
          <SectionCard title="Owner verification rate" sub="Owner accounts by verification status">
            <BreakdownBarChart data={breakdown.verificationBreakdown} />
          </SectionCard>
        ) : null}
        {canFinance ? (
          <>
            <SectionCard title="Donation outcomes" sub="Refunds & failures across all donations">
              <BreakdownBarChart data={breakdown.donationOutcomes} />
            </SectionCard>
            <SectionCard title="Payout timeline" sub="Payout amount by stage (ETB)">
              <BreakdownBarChart data={breakdown.payoutTimeline} money />
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}

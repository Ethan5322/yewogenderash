import Link from "next/link";
import { Download } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { getAdminAnalytics, getBreakdownAnalytics } from "@/lib/analytics";
import {
  DonationsTrendChart,
  BreakdownBarChart,
} from "@/components/admin/analytics-charts";
import { DashboardToolbar } from "@/components/admin/dashboard-toolbar";
import { PageHeader, KpiCard, SectionCard } from "@/components/admin/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Reports" };

const RANGES = [7, 30, 90] as const;

function pct(numerator: number, denominator: number): string {
  if (denominator <= 0) return "—";
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("payouts");
  const sp = await searchParams;
  const rawRange = Number(typeof sp.range === "string" ? sp.range : 30);
  const range = (RANGES as readonly number[]).includes(rawRange) ? rawRange : 30;

  const [analytics, breakdown, donationStatus, verificationStatus] = await Promise.all([
    getAdminAnalytics(range),
    getBreakdownAnalytics(),
    db.donation.groupBy({ by: ["status"], _count: { _all: true } }),
    db.user.groupBy({
      by: ["verificationStatus"],
      where: { ownerProfile: { isNot: null } },
      _count: { _all: true },
    }),
  ]);

  const dCount = (s: string) => donationStatus.find((r) => r.status === s)?._count._all ?? 0;
  const vCount = (s: string) => verificationStatus.find((r) => r.verificationStatus === s)?._count._all ?? 0;

  const totalDonations = donationStatus.reduce((n, r) => n + r._count._all, 0);
  const successDonations = dCount("SUCCESS");
  const totalOwners = verificationStatus.reduce((n, r) => n + r._count._all, 0);

  const kpis = [
    { label: "Donation success rate", value: pct(successDonations, totalDonations), sub: `${successDonations} of ${totalDonations}`, tone: "success" as const },
    { label: "Refund rate", value: pct(dCount("REFUNDED"), successDonations), sub: `${dCount("REFUNDED")} refunded`, tone: "warning" as const },
    { label: "Dispute rate", value: pct(dCount("DISPUTED"), successDonations), sub: `${dCount("DISPUTED")} disputed`, tone: "danger" as const },
    { label: "Verification success", value: pct(vCount("VERIFIED"), totalOwners), sub: `${vCount("VERIFIED")} of ${totalOwners} owners`, tone: "info" as const },
  ];

  return (
    <div>
      <PageHeader
        title="Reports & Analytics"
        description="Business and compliance performance across donations, payouts and verification."
        actions={
          <>
            <div className="hidden items-center rounded-md border border-input bg-background p-0.5 shadow-sm sm:flex">
              {RANGES.map((r) => (
                <Link
                  key={r}
                  href={`/admin/reports?range=${r}`}
                  className={cn(
                    "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                    range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {r}d
                </Link>
              ))}
            </div>
            <a
              href="/admin/donations/export?status=ALL"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <Download className="h-4 w-4" aria-hidden /> Export CSV
            </a>
            <DashboardToolbar />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k) => (
          <KpiCard key={k.label} {...k} />
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Donations raised" sub={`Per day · last ${range} days (ETB)`}>
          <DonationsTrendChart data={analytics.donationsByDay} />
        </SectionCard>
        <SectionCard title="Payouts released" sub={`Per day · last ${range} days (ETB)`}>
          <DonationsTrendChart data={analytics.payoutsByDay} />
        </SectionCard>
        <SectionCard title="Category performance" sub="Raised by category (ETB)">
          <BreakdownBarChart data={breakdown.categoryPerformance} money />
        </SectionCard>
        <SectionCard title="Verification breakdown" sub="Owners by verification status">
          <BreakdownBarChart data={breakdown.verificationBreakdown} />
        </SectionCard>
        <SectionCard title="Donation outcomes" sub="Refunds & failures">
          <BreakdownBarChart data={breakdown.donationOutcomes} />
        </SectionCard>
        <SectionCard title="Payout timeline" sub="Amount by stage (ETB)">
          <BreakdownBarChart data={breakdown.payoutTimeline} money />
        </SectionCard>
      </div>
    </div>
  );
}

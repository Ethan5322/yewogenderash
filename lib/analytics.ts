import "server-only";
import type { CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";

export type DonationDay = { date: string; label: string; total: number };
export type StatusCount = { status: CampaignStatus; label: string; count: number };

const DAY_MS = 24 * 60 * 60 * 1000;

/** UTC midnight key (YYYY-MM-DD) so buckets are deterministic regardless of TZ. */
function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Fixed display order + labels so the bar chart is stable and a status with a
// zero count still shows.
const STATUS_ORDER: { status: CampaignStatus; label: string }[] = [
  { status: "DRAFT", label: "Draft" },
  { status: "PENDING_REVIEW", label: "Pending review" },
  { status: "ACTIVE", label: "Active" },
  { status: "SUSPENDED", label: "Suspended" },
  { status: "COMPLETED", label: "Completed" },
  { status: "REJECTED", label: "Rejected" },
  { status: "ARCHIVED", label: "Archived" },
];

/**
 * Dashboard analytics: successful-donation totals per day over a trailing
 * window, and campaign counts by status. Donations are bucketed in JS (small
 * volumes) keyed on paidAt — when the money actually landed.
 */
export async function getAdminAnalytics(days = 30): Promise<{
  donationsByDay: DonationDay[];
  campaignsByStatus: StatusCount[];
}> {
  const since = new Date(Date.now() - (days - 1) * DAY_MS);
  since.setUTCHours(0, 0, 0, 0);

  const [donations, statusGroups] = await Promise.all([
    db.donation.findMany({
      where: { status: "SUCCESS", paidAt: { gte: since } },
      select: { amount: true, paidAt: true },
    }),
    db.campaign.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  // Pre-seed every day in the window at 0 so the line has no gaps.
  const sums = new Map<string, number>();
  for (let i = 0; i < days; i++) {
    sums.set(dayKey(new Date(since.getTime() + i * DAY_MS)), 0);
  }
  for (const d of donations) {
    if (!d.paidAt) continue;
    const key = dayKey(d.paidAt);
    sums.set(key, (sums.get(key) ?? 0) + Number(d.amount));
  }

  const labelFmt = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const donationsByDay: DonationDay[] = [...sums.entries()].map(([date, total]) => ({
    date,
    label: labelFmt.format(new Date(`${date}T00:00:00Z`)),
    total,
  }));

  const counts = new Map(statusGroups.map((g) => [g.status, g._count._all]));
  const campaignsByStatus: StatusCount[] = STATUS_ORDER.map(({ status, label }) => ({
    status,
    label,
    count: counts.get(status) ?? 0,
  }));

  return { donationsByDay, campaignsByStatus };
}

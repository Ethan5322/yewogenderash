import "server-only";
import type { CampaignCategory, CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { CATEGORY_LABELS } from "@/lib/campaign-types";

export type DonationDay = { date: string; label: string; total: number };
export type StatusCount = { status: CampaignStatus; label: string; count: number };
export type Bar = { label: string; value: number };

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

const CATEGORY_ORDER: CampaignCategory[] = [
  "MEDICAL", "EDUCATION", "COMMUNITY", "BUSINESS", "EMERGENCY", "OTHER",
];
const VERIFICATION_ORDER: { key: string; label: string }[] = [
  { key: "VERIFIED", label: "Verified" },
  { key: "PENDING", label: "Pending" },
  { key: "REJECTED", label: "Rejected" },
  { key: "RESUBMIT", label: "Resubmit" },
  { key: "UNVERIFIED", label: "Unverified" },
];
const DONATION_OUTCOME_ORDER: { key: string; label: string }[] = [
  { key: "SUCCESS", label: "Successful" },
  { key: "PENDING", label: "Pending" },
  { key: "FAILED", label: "Failed" },
  { key: "REFUNDED", label: "Refunded" },
  { key: "DISPUTED", label: "Disputed" },
  { key: "CANCELLED", label: "Cancelled" },
];
const PAYOUT_ORDER: { key: string; label: string }[] = [
  { key: "REQUESTED", label: "Requested" },
  { key: "APPROVED", label: "Approved" },
  { key: "PAID", label: "Paid" },
  { key: "REJECTED", label: "Rejected" },
  { key: "CANCELLED", label: "Cancelled" },
];

/**
 * The rest of the §12.8 analytics suite: category performance, owner
 * verification rate, donation outcomes (refunds & failures), and payout
 * timelines. Returned as simple {label,value} bars.
 */
export async function getBreakdownAnalytics(): Promise<{
  categoryPerformance: Bar[];
  verificationBreakdown: Bar[];
  donationOutcomes: Bar[];
  payoutTimeline: Bar[];
}> {
  const [catGroups, verGroups, donGroups, payGroups] = await Promise.all([
    db.campaign.groupBy({ by: ["category"], _sum: { currentAmount: true } }),
    db.user.groupBy({ by: ["verificationStatus"], _count: { _all: true }, where: { ownerProfile: { isNot: null } } }),
    db.donation.groupBy({ by: ["status"], _count: { _all: true } }),
    db.payout.groupBy({ by: ["status"], _sum: { amount: true } }),
  ]);

  const catMap = new Map(catGroups.map((g) => [g.category, Number(g._sum.currentAmount ?? 0)]));
  const verMap = new Map(verGroups.map((g) => [g.verificationStatus, g._count._all]));
  const donMap = new Map(donGroups.map((g) => [g.status, g._count._all]));
  const payMap = new Map(payGroups.map((g) => [g.status, Number(g._sum.amount ?? 0)]));

  return {
    categoryPerformance: CATEGORY_ORDER.map((c) => ({ label: CATEGORY_LABELS[c], value: catMap.get(c) ?? 0 })),
    verificationBreakdown: VERIFICATION_ORDER.map((v) => ({ label: v.label, value: verMap.get(v.key as never) ?? 0 })),
    donationOutcomes: DONATION_OUTCOME_ORDER.map((d) => ({ label: d.label, value: donMap.get(d.key as never) ?? 0 })),
    payoutTimeline: PAYOUT_ORDER.map((p) => ({ label: p.label, value: payMap.get(p.key as never) ?? 0 })),
  };
}

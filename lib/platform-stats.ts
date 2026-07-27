import "server-only";
import { unstable_cache } from "next/cache";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export type PlatformTotals = {
  /** Gross confirmed donations across every campaign. */
  raised: number;
  /** Confirmed donations — the count of individual acts of giving. */
  donations: number;
  /** Campaigns that have been reviewed and published (live or completed). */
  campaigns: number;
  /** Campaigns that reached their goal. */
  funded: number;
  /** Fundraisers who passed identity verification. */
  verifiedFundraisers: number;
};

/**
 * Platform-wide totals for the public homepage.
 *
 * First-time visitors have no way to judge whether anyone else trusts the
 * platform; these are the numbers that answer that. Counted from confirmed
 * (SUCCESS) donations only — never pending or failed ones — so the figure on the
 * homepage is money that actually arrived.
 *
 * Cached for five minutes rather than read per request: the homepage is
 * force-dynamic for live campaign data, and these aggregates would otherwise add
 * five scans to every visit for numbers that barely move.
 */
export const getPlatformTotals = unstable_cache(
  async (): Promise<PlatformTotals> => {
    try {
      const [donationAgg, campaigns, funded, verified] = await Promise.all([
        db.donation.aggregate({
          where: { status: "SUCCESS" },
          _sum: { amount: true },
          _count: true,
        }),
        db.campaign.count({ where: { status: { in: ["ACTIVE", "COMPLETED"] } } }),
        db.campaign.count({ where: { status: "COMPLETED" } }),
        db.campaignOwner.count({ where: { mulesooVerified: true } }),
      ]);
      return {
        raised: toNumber(donationAgg._sum.amount ?? 0),
        donations: donationAgg._count,
        campaigns,
        funded,
        verifiedFundraisers: verified,
      };
    } catch {
      // The homepage must render even if the database is unreachable; zeroes are
      // suppressed by the caller rather than shown as real figures.
      return { raised: 0, donations: 0, campaigns: 0, funded: 0, verifiedFundraisers: 0 };
    }
  },
  ["platform-totals"],
  { revalidate: 300, tags: ["platform-totals"] }
);

/**
 * Compact display form for a large birr figure — "ETB 1.2M", "ETB 450K".
 * Full precision belongs on a campaign page; a headline stat needs to be read at
 * a glance.
 */
export function compactETB(value: number, currency = "ETB"): string {
  const n = Math.max(0, value);
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${currency} ${(m >= 10 ? Math.round(m) : Math.round(m * 10) / 10).toLocaleString("en-US")}M`;
  }
  if (n >= 10_000) return `${currency} ${Math.round(n / 1000).toLocaleString("en-US")}K`;
  return `${currency} ${Math.round(n).toLocaleString("en-US")}`;
}

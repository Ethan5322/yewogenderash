import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export const MIN_PAYOUT_ETB = 100;

/**
 * Available balance for a campaign = confirmed donations minus every payout
 * that is requested, approved, or already paid. Requested funds are reserved
 * immediately so an owner can never over-request across parallel payouts.
 */
export async function campaignAvailableBalance(campaignId: string): Promise<number> {
  const [campaign, reserved] = await Promise.all([
    db.campaign.findUnique({
      where: { id: campaignId },
      select: { currentAmount: true },
    }),
    db.payout.aggregate({
      where: { campaignId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);
  if (!campaign) return 0;
  return toNumber(campaign.currentAmount) - toNumber(reserved._sum.amount ?? 0);
}

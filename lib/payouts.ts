import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";

export const MIN_PAYOUT_ETB = 100;

/**
 * Ceiling for automated approval. Requests at or below this settle through the
 * auto-approval rules; larger ones always go to a human reviewer.
 */
export const AUTO_APPROVE_MAX_ETB = 5000;

/**
 * Decide whether a withdrawal request can skip manual review. Conservative by
 * design (brief §13.1 "manual payout approval for new owners"): a request
 * auto-approves ONLY for a fully-verified owner, with a verified payout
 * account, a prior completed payout (established track record), and an amount
 * within the ceiling. Anything else routes to admin review.
 *
 * Auto-approval clears the REVIEW gate only — the actual money movement (PAID +
 * transfer reference) stays a controlled admin/backend step.
 */
export async function evaluateWithdrawalApproval(params: {
  ownerId: string;
  mulesooVerified: boolean;
  hasVerifiedAccount: boolean;
  amount: number;
}): Promise<{ autoApprove: boolean; reason: string }> {
  if (!params.mulesooVerified) {
    return { autoApprove: false, reason: "Owner not fully verified — manual review" };
  }
  if (!params.hasVerifiedAccount) {
    return { autoApprove: false, reason: "No verified payout account — manual review" };
  }
  if (params.amount > AUTO_APPROVE_MAX_ETB) {
    return {
      autoApprove: false,
      reason: `Amount over auto-approval limit (ETB ${AUTO_APPROVE_MAX_ETB.toLocaleString()}) — manual review`,
    };
  }
  const priorPaid = await db.payout.count({
    where: { ownerId: params.ownerId, status: "PAID" },
  });
  if (priorPaid === 0) {
    return { autoApprove: false, reason: "First payout for this owner — manual review" };
  }
  return {
    autoApprove: true,
    reason: `Auto-approved: verified owner, ${priorPaid} prior payout(s), amount within ETB ${AUTO_APPROVE_MAX_ETB.toLocaleString()} limit`,
  };
}

/**
 * Available balance for a campaign = confirmed NET donations (gross minus the
 * 3% platform fee — the fee is never withdrawable) minus every payout that is
 * requested, approved, or already paid. Requested funds are reserved
 * immediately so an owner can never over-request across parallel payouts.
 *
 * Computed from the donation ledger (not the CampaignBalance denorm) so it is
 * always correct even if the denorm drifts.
 */
export async function campaignAvailableBalance(campaignId: string): Promise<number> {
  const [netRaised, reserved] = await Promise.all([
    db.donation.aggregate({
      where: { campaignId, status: "SUCCESS" },
      _sum: { netAmount: true },
    }),
    db.payout.aggregate({
      where: { campaignId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);
  return toNumber(netRaised._sum.netAmount ?? 0) - toNumber(reserved._sum.amount ?? 0);
}

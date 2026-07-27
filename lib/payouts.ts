import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { getPlatformSettings } from "@/lib/settings";
import { computeWithdrawal, withholdingTotalFor } from "@/lib/fees";

export const MIN_PAYOUT_ETB = 100;

/**
 * Fallback ceiling for automated approval. The live value is editable by the
 * main admin (Settings) and read via getPlatformSettings(); this constant is
 * only the default the settings row seeds with.
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
  const { autoApproveMaxEtb } = await getPlatformSettings();
  if (params.amount > autoApproveMaxEtb) {
    return {
      autoApprove: false,
      reason: `Amount over auto-approval limit (ETB ${autoApproveMaxEtb.toLocaleString()}) — manual review`,
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
    reason: `Auto-approved: verified owner, ${priorPaid} prior payout(s), amount within ETB ${autoApproveMaxEtb.toLocaleString()} limit`,
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

export type OwnerCampaignBalance = {
  id: string;
  title: string;
  slug: string;
  status: string;
  gross: number;
  fees: number;
  net: number;
  paid: number;
  reserved: number;
  available: number;
};

export type OwnerBalanceSummary = {
  gross: number;
  fees: number;
  net: number;
  paid: number;
  /** Requested + approved but not yet paid — reserved against net. */
  reserved: number;
  /** net − paid − reserved: what the fundraiser could still withdraw. */
  available: number;
  campaigns: OwnerCampaignBalance[];
};

/**
 * Every-campaign financial rollup for one fundraiser, so an admin can answer
 * "what is this fundraiser holding?" in one place.
 *
 * Like campaignAvailableBalance() this is derived from the donation and payout
 * ledgers rather than the CampaignBalance denorm, so it stays correct even if
 * the denorm drifts. Funds are still per-campaign — this only *reports* the
 * total; it never implies a pooled balance the owner can draw against.
 */
export async function ownerBalanceSummary(
  ownerId: string
): Promise<OwnerBalanceSummary> {
  const campaigns = await db.campaign.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, slug: true, status: true },
  });
  if (campaigns.length === 0) {
    return { gross: 0, fees: 0, net: 0, paid: 0, reserved: 0, available: 0, campaigns: [] };
  }

  const ids = campaigns.map((c) => c.id);
  const [donationRows, payoutRows] = await Promise.all([
    db.donation.groupBy({
      by: ["campaignId"],
      where: { campaignId: { in: ids }, status: "SUCCESS" },
      _sum: { amount: true, platformFee: true, netAmount: true },
    }),
    db.payout.groupBy({
      by: ["campaignId", "status"],
      where: { campaignId: { in: ids }, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { amount: true },
    }),
  ]);

  const donationBy = new Map(donationRows.map((r) => [r.campaignId, r]));
  const paidBy = new Map<string, number>();
  const reservedBy = new Map<string, number>();
  for (const r of payoutRows) {
    const amount = toNumber(r._sum.amount ?? 0);
    const target = r.status === "PAID" ? paidBy : reservedBy;
    target.set(r.campaignId, (target.get(r.campaignId) ?? 0) + amount);
  }

  const rows: OwnerCampaignBalance[] = campaigns.map((c) => {
    const d = donationBy.get(c.id);
    const gross = toNumber(d?._sum.amount ?? 0);
    const fees = toNumber(d?._sum.platformFee ?? 0);
    const net = toNumber(d?._sum.netAmount ?? 0);
    const paid = paidBy.get(c.id) ?? 0;
    const reserved = reservedBy.get(c.id) ?? 0;
    return {
      ...c,
      gross,
      fees,
      net,
      paid,
      reserved,
      available: net - paid - reserved,
    };
  });

  const sum = (pick: (r: OwnerCampaignBalance) => number) =>
    rows.reduce((acc, r) => acc + pick(r), 0);

  return {
    gross: sum((r) => r.gross),
    fees: sum((r) => r.fees),
    net: sum((r) => r.net),
    paid: sum((r) => r.paid),
    reserved: sum((r) => r.reserved),
    available: sum((r) => r.available),
    campaigns: rows,
  };
}

/**
 * How much of a campaign's one-off safety & guarantee withholding (7% of its
 * gross) has yet to be charged.
 *
 * Counts withholding already taken on payouts that still stand — a rejected or
 * cancelled request never collected anything, so its share becomes due again.
 */
export async function campaignWithholdingDue(campaignId: string): Promise<{
  total: number;
  charged: number;
  due: number;
}> {
  const [donations, charged] = await Promise.all([
    db.donation.aggregate({
      where: { campaignId, status: "SUCCESS" },
      _sum: { amount: true },
    }),
    db.payout.aggregate({
      where: { campaignId, status: { in: ["REQUESTED", "APPROVED", "PAID"] } },
      _sum: { withholdingFee: true },
    }),
  ]);
  const total = withholdingTotalFor(toNumber(donations._sum.amount ?? 0));
  const already = toNumber(charged._sum.withholdingFee ?? 0);
  return {
    total,
    charged: already,
    due: Math.max(0, Math.round((total - already) * 100) / 100),
  };
}

/**
 * What a fundraiser would actually receive for a given withdrawal request, and
 * the deduction that explains the difference. Used to show the breakdown on the
 * request form BEFORE they commit, and again when the request is recorded.
 */
export async function quoteWithdrawal(campaignId: string, requested: number) {
  const { due, total, charged } = await campaignWithholdingDue(campaignId);
  const quote = computeWithdrawal(requested, due);
  return { ...quote, withholdingDue: due, withholdingTotal: total, withholdingCharged: charged };
}

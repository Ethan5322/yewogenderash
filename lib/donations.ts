import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { verifyChapaTransaction } from "@/lib/chapa";
import { toNumber } from "@/lib/format";
import { computeFeeSplit } from "@/lib/fees";

export const MIN_DONATION_ETB = 10;
export const MAX_DONATION_ETB = 1_000_000;

/** Our transaction reference sent to Chapa — unique per donation, forever. */
export function newTxRef(): string {
  return `YWD-${randomUUID()}`;
}

/**
 * Settle a PENDING donation against the gateway's authoritative verify
 * endpoint. Called from the webhook (normal path) and from the thank-you
 * page (fallback when a webhook was missed — e.g. local dev).
 *
 * The core money invariant lives here and nowhere else:
 *   - a donation flips PENDING → SUCCESS at most once (guarded update)
 *   - campaign.currentAmount increments in the SAME transaction, by the NET
 *     amount (see below) — gross stays on the donation row
 *   - the amount verified against the gateway is OUR stored gross amount, and it
 *     is credited only if the gateway's confirmed amount+currency match exactly
 */
export async function settleDonation(
  txRef: string
): Promise<
  | { outcome: "success" | "already_settled" | "failed" | "still_pending" }
  | { outcome: "not_found" }
  | { outcome: "amount_mismatch"; detail: string }
  | { outcome: "verify_error"; detail: string }
> {
  const donation = await db.donation.findUnique({
    where: { txRef },
    include: {
      campaign: {
        select: {
          id: true,
          title: true,
          ownerId: true,
          currency: true,
          owner: {
            select: {
              payoutAccounts: {
                where: { isDefault: true, isVerified: true },
                select: { chapaSubaccountId: true, feeRate: true },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
  if (!donation) return { outcome: "not_found" };
  if (donation.status === "SUCCESS") return { outcome: "already_settled" };
  if (donation.status !== "PENDING") return { outcome: "failed" };

  const verified = await verifyChapaTransaction(txRef);
  if (!verified.ok) return { outcome: "verify_error", detail: verified.error };

  const gw = verified.data;
  if (gw.status === "pending") return { outcome: "still_pending" };

  if (gw.status !== "success") {
    await db.donation.updateMany({
      where: { id: donation.id, status: "PENDING" },
      data: { status: "FAILED", webhookPayload: gw as object },
    });
    return { outcome: "failed" };
  }

  // Gateway says success — the money must match what we asked for.
  const expected = toNumber(donation.amount);
  const paid = Number(gw.amount);
  if (paid !== expected || gw.currency !== donation.currency) {
    const detail = `expected ${expected} ${donation.currency}, gateway reports ${gw.amount} ${gw.currency}`;
    await db.auditLog.create({
      data: {
        action: "DONATION_AMOUNT_MISMATCH",
        entityType: "Donation",
        entityId: donation.id,
        detail: { txRef, detail },
      },
    });
    return { outcome: "amount_mismatch", detail };
  }

  // The platform fee split. Chapa moves the money via the subaccount split; we
  // record the exact figures here so the ledger is authoritative regardless.
  // Use the rate baked into THIS owner's subaccount (falling back to the current
  // default) so the ledger always reconciles with what Chapa actually routed.
  const account = donation.campaign.owner?.payoutAccounts[0];
  const split = computeFeeSplit(expected, account?.feeRate ?? undefined);
  const subaccountId = account?.chapaSubaccountId ?? null;

  const settled = await db.$transaction(async (tx) => {
    // Guarded flip — a concurrent settle (webhook + thanks page racing)
    // loses here and credits nothing.
    const flipped = await tx.donation.updateMany({
      where: { id: donation.id, status: "PENDING" },
      data: {
        status: "SUCCESS",
        paidAt: new Date(),
        gatewayTransactionId: gw.reference ?? null,
        webhookPayload: gw as object,
        platformFee: split.fee,
        netAmount: split.net,
        feeRate: split.rate,
      },
    });
    if (flipped.count === 0) return false;

    // currentAmount is NET — what the campaign actually receives, after the
    // transaction fee. It used to track gross.
    //
    // This is the single place the meaning is decided, and it is deliberately
    // stored rather than converted on read: currentAmount is read in 46 places
    // (public campaign pages, goal progress, admin lists, analytics, SEO
    // metadata, sort order). Netting it at each of those would mean every future
    // read site has to remember, and one that forgets shows a different total
    // from the rest — the same class of defect as the balance table dropped in
    // migration 0022.
    //
    // Gross is not lost: it is yd_donations.amount, which is what the fee ledger
    // and the 7% withholding are still calculated from.
    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { increment: split.net } },
    });

    // Append-only fee record — one row per settled donation.
    await tx.feeLedger.create({
      data: {
        donationId: donation.id,
        campaignId: donation.campaignId,
        grossAmount: split.gross,
        feeAmount: split.fee,
        netAmount: split.net,
        feeRate: split.rate,
        currency: donation.currency,
        chapaSubaccountId: subaccountId,
      },
    });

    // No balance denorm here any more. yd_campaign_balances used to be updated
    // at this point; it was removed in migration 0022 because nothing read it and
    // nothing decremented it on payout, so it drifted the moment money left.
    // Balances come from campaignAvailableBalance(), which computes from this
    // ledger minus payouts — one source of truth rather than two that disagree.

    // Owner alert — delivery happens in the notification worker (phase 11).
    await tx.notification.create({
      data: {
        ownerId: donation.campaign.ownerId,
        campaignId: donation.campaignId,
        channel: "WHATSAPP",
        message: `New donation: ETB ${expected.toLocaleString()} to "${donation.campaign.title}" — net ETB ${split.net.toLocaleString()} after 3% fee (${txRef})`,
      },
    });
    return true;
  });

  return { outcome: settled ? "success" : "already_settled" };
}

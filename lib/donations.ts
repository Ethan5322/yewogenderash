import "server-only";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { verifyChapaTransaction } from "@/lib/chapa";
import { toNumber } from "@/lib/format";

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
 *   - campaign.currentAmount increments in the SAME transaction
 *   - the amount credited is OUR stored amount, only if the gateway's
 *     confirmed amount+currency match it exactly
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
    include: { campaign: { select: { id: true, title: true, ownerId: true } } },
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
      },
    });
    if (flipped.count === 0) return false;

    await tx.campaign.update({
      where: { id: donation.campaignId },
      data: { currentAmount: { increment: donation.amount } },
    });

    // Owner alert — delivery happens in the notification worker (phase 11).
    await tx.notification.create({
      data: {
        ownerId: donation.campaign.ownerId,
        campaignId: donation.campaignId,
        channel: "WHATSAPP",
        message: `New donation: ETB ${expected.toLocaleString()} to "${donation.campaign.title}" (${txRef})`,
      },
    });
    return true;
  });

  return { outcome: settled ? "success" : "already_settled" };
}

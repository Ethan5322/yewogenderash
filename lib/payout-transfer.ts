import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { getPlatformSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";
import {
  initiateChapaTransfer,
  chapaTransfersEnabled,
  type TransferResult,
} from "@/lib/chapa";

/**
 * Sending a payout to a fundraiser's bank.
 *
 * This is the only code in the project that moves money OUT. Read
 * docs/PHASE-5-CHAPA-PAYOUTS.md before changing it; the shape here is dictated
 * by one failure — we send the instruction and never learn the outcome — and
 * every rule below exists to make that case survivable rather than convenient.
 */

export type SendResult =
  | { ok: true; outcome: "SUCCESS" }
  | { ok: true; outcome: "PENDING"; message: string }
  | { ok: false; error: string };

/** Why a payout cannot be sent, in words an admin can act on. */
export const TRANSFER_BLOCKED: Record<string, string> = {
  disabled:
    "Automatic transfers are switched off (CHAPA_TRANSFERS_ENABLED). Transfer this payout by hand and record the reference.",
  not_found: "Payout not found.",
  not_approved:
    "Only an APPROVED payout can be transferred. Approve it first, or it has already been sent.",
  already_attempted:
    "A transfer has already been attempted for this payout. Check its status before doing anything else — never send a second one.",
  over_ceiling:
    "This payout is above the automatic transfer ceiling. Transfer it by hand and record the reference.",
  no_account: "This fundraiser has no verified payout account with a bank code.",
  no_amount: "This payout has no net amount to transfer.",
};

/**
 * A reference of ours, unique per payout, used as Chapa's `reference` and
 * therefore as the idempotency key. Random rather than derived from the payout id
 * so it cannot be reconstructed and accidentally reused after a failure — a
 * second reference for the same payout is a second payment.
 */
function newTransferReference(): string {
  return `YD-${Date.now().toString(36).toUpperCase()}-${randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
}

/**
 * Send one payout. Called by an admin action — never automatically, never in a
 * loop, never as a retry.
 *
 * `injectedTransfer` exists only so tests can stand in for Chapa. Production
 * passes nothing.
 */
export async function sendPayoutTransfer(
  payoutId: string,
  adminId: string,
  injectedTransfer?: typeof initiateChapaTransfer
): Promise<SendResult> {
  if (!chapaTransfersEnabled()) {
    return { ok: false, error: TRANSFER_BLOCKED.disabled };
  }

  const payout = await db.payout.findUnique({
    where: { id: payoutId },
    select: {
      id: true,
      status: true,
      currency: true,
      netPaidAmount: true,
      amount: true,
      transferStatus: true,
      ownerId: true,
      campaign: { select: { title: true } },
      payoutAccountRef: {
        select: {
          accountNumber: true,
          accountName: true,
          bankCode: true,
          isVerified: true,
        },
      },
    },
  });

  if (!payout) return { ok: false, error: TRANSFER_BLOCKED.not_found };
  if (payout.status !== "APPROVED") {
    return { ok: false, error: TRANSFER_BLOCKED.not_approved };
  }
  // A transfer that was attempted — even one whose outcome is unknown — must
  // never be attempted again from here. Reconciliation resolves it.
  if (payout.transferStatus !== null) {
    return { ok: false, error: TRANSFER_BLOCKED.already_attempted };
  }

  const account = payout.payoutAccountRef;
  if (!account?.isVerified || !account.bankCode || !account.accountNumber) {
    return { ok: false, error: TRANSFER_BLOCKED.no_account };
  }

  // The amount comes from the row, never from the caller. netPaidAmount is what
  // the fundraiser receives; `amount` is what was reserved against the balance
  // and includes the withholding the platform keeps.
  const net = toNumber(payout.netPaidAmount ?? 0);
  if (net <= 0) return { ok: false, error: TRANSFER_BLOCKED.no_amount };

  const { maxAutoTransferEtb } = await getPlatformSettings();
  if (net > maxAutoTransferEtb) {
    return {
      ok: false,
      error: `${TRANSFER_BLOCKED.over_ceiling} Ceiling is ETB ${maxAutoTransferEtb.toLocaleString()}; this payout is ETB ${net.toLocaleString()}.`,
    };
  }

  // ── Claim the payout ──────────────────────────────────────────────────────
  // One UPDATE that both checks and marks, so two admins clicking at the same
  // moment cannot both proceed: the second matches zero rows. This is the same
  // check-then-act race that migration 0020 closed for payout creation, and the
  // consequence here is identical — a person paid twice.
  //
  // Committed BEFORE Chapa is contacted, so a crash mid-call leaves a PENDING
  // row with a reference rather than no trace at all.
  const reference = newTransferReference();
  const claimed = await db.payout.updateMany({
    where: { id: payout.id, status: "APPROVED", transferStatus: null },
    data: {
      transferReference: reference,
      transferStatus: "PENDING",
      transferAttemptedAt: new Date(),
    },
  });
  if (claimed.count === 0) {
    return { ok: false, error: TRANSFER_BLOCKED.already_attempted };
  }

  await writeAudit({
    actorId: adminId,
    action: "PAYOUT_TRANSFER_SENT",
    entityType: "Payout",
    entityId: payout.id,
    detail: { reference, amount: net, currency: payout.currency },
  });

  // ── Send ──────────────────────────────────────────────────────────────────
  const send = injectedTransfer ?? initiateChapaTransfer;
  const result: TransferResult = await send({
    accountNumber: account.accountNumber,
    accountName: account.accountName ?? undefined,
    amount: net,
    bankCode: account.bankCode,
    reference,
    currency: payout.currency,
  });

  return recordTransferOutcome({
    payoutId: payout.id,
    ownerId: payout.ownerId,
    campaignTitle: payout.campaign?.title ?? "your campaign",
    reference,
    net,
    currency: payout.currency,
    adminId,
    result,
  });
}

/**
 * Persist what Chapa said. Shared with reconciliation so a transfer settled an
 * hour later is recorded exactly like one settled immediately — two code paths
 * writing the same state differently is how ledgers start disagreeing.
 */
export async function recordTransferOutcome(params: {
  payoutId: string;
  ownerId: string;
  campaignTitle: string;
  reference: string;
  net: number;
  currency: string;
  adminId: string | null;
  result: TransferResult;
}): Promise<SendResult> {
  const { payoutId, result, reference, net, currency } = params;

  if (result.outcome === "SUCCESS") {
    await db.payout.update({
      where: { id: payoutId },
      data: {
        transferStatus: "SUCCESS",
        chapaTransferId: result.transferId,
        transferResponse: result.raw as never,
        // Only NOW is the business state paid. Before this the money had not
        // demonstrably moved.
        status: "PAID",
        paidAt: new Date(),
        payoutReference: reference,
      },
    });
    await notifyOwner(params, "success");
    await writeAudit({
      actorId: params.adminId,
      action: "PAYOUT_TRANSFER_SUCCESS",
      entityType: "Payout",
      entityId: payoutId,
      detail: { reference, amount: net, currency, chapaTransferId: result.transferId },
    });
    return { ok: true, outcome: "SUCCESS" };
  }

  if (result.outcome === "FAILED") {
    // A refusal. The money never left, so the payout goes back to being an
    // approved request a human can deal with — deliberately NOT rejected, which
    // would be a decision about the fundraiser rather than about the bank.
    await db.payout.update({
      where: { id: payoutId },
      data: {
        transferStatus: "FAILED",
        transferFailureReason: result.error ?? "Transfer refused",
        transferResponse: result.raw as never,
      },
    });
    await notifyOwner(params, "failed");
    await writeAudit({
      actorId: params.adminId,
      action: "PAYOUT_TRANSFER_FAILED",
      entityType: "Payout",
      entityId: payoutId,
      detail: { reference, reason: result.error ?? null },
    });
    return { ok: false, error: result.error ?? "The transfer was refused." };
  }

  // PENDING or UNKNOWN. Both mean: we do not know, and we must not guess.
  // transferStatus stays PENDING (set when the payout was claimed) and the
  // business status stays APPROVED. The fundraiser is told NOTHING yet, because
  // there is nothing true to tell them. Reconciliation owns it from here.
  await db.payout.update({
    where: { id: payoutId },
    data: { transferResponse: result.raw as never },
  });
  await writeAudit({
    actorId: params.adminId,
    action: "PAYOUT_TRANSFER_UNRESOLVED",
    entityType: "Payout",
    entityId: payoutId,
    detail: { reference, outcome: result.outcome, note: result.error ?? null },
  });
  return {
    ok: true,
    outcome: "PENDING",
    message:
      "The transfer was sent but Chapa has not confirmed it yet. Do NOT send it again — it will be checked automatically and settled. ",
  };
}

/**
 * Tell the fundraiser, in their existing messages inbox.
 *
 * Only ever called for a CONFIRMED outcome. A "your money is on its way" message
 * for a transfer we cannot confirm would be the worst of both worlds.
 */
async function notifyOwner(
  params: {
    ownerId: string;
    campaignTitle: string;
    net: number;
    currency: string;
    reference: string;
  },
  kind: "success" | "failed"
): Promise<void> {
  const amount = `${params.currency} ${params.net.toLocaleString()}`;
  const body =
    kind === "success"
      ? [
          `Your withdrawal for "${params.campaignTitle}" has been transferred.`,
          ``,
          `Amount sent: ${amount}`,
          `Reference: ${params.reference}`,
          ``,
          `It should appear in your bank account shortly. If it has not arrived within 3 working days, reply to this message with the reference above.`,
        ].join("\n")
      : [
          `We could not complete the transfer for "${params.campaignTitle}".`,
          ``,
          `Amount: ${amount}`,
          ``,
          `Your funds are safe and still on your balance — nothing has been lost. This is usually a problem with the bank details on your payout account. Please check them under Payouts, then reply here and we will send it again.`,
        ].join("\n");

  try {
    await db.message.create({
      data: {
        ownerId: params.ownerId,
        fromAdmin: true,
        subject:
          kind === "success"
            ? `Withdrawal sent — ${amount}`
            : `Withdrawal could not be sent`,
        body,
      },
    });
  } catch (e) {
    // Never let a notification failure change the money outcome: the transfer
    // has already happened either way, and losing that record to a failed
    // insert would be far worse than a missing message.
    console.error("payout transfer: owner notification failed (continuing)", e);
  }
}

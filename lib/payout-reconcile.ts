import "server-only";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import { verifyChapaTransfer, type TransferResult } from "@/lib/chapa";
import { recordTransferOutcome } from "@/lib/payout-transfer";

/**
 * Reconciliation — deciding what happened to transfers we could not confirm.
 *
 * This is not a nice-to-have bolted onto the send path; it is the half that
 * makes the send path safe. sendPayoutTransfer deliberately leaves a transfer
 * PENDING whenever the outcome is unclear, because the alternatives are paying
 * twice or lying to a fundraiser. Something has to come back and settle those,
 * and asking Chapa is the only safe way to do it.
 *
 * The one rule: this module NEVER sends a transfer. It only reads Chapa's
 * verdict and records it.
 */

/** Don't chase a transfer that is only seconds old — it is probably in flight. */
const SETTLE_AFTER_MS = 3 * 60 * 1000;

/** A PENDING transfer older than this is not "slow", it is a problem. */
const STUCK_AFTER_MS = 24 * 60 * 60 * 1000;

export type ReconcileSummary = {
  checked: number;
  settledPaid: number;
  settledFailed: number;
  stillPending: number;
};

/**
 * Ask Chapa about every unresolved transfer and settle the ones it can answer.
 *
 * `injectedVerify` is for tests only; production passes nothing.
 */
export async function reconcilePendingTransfers(
  injectedVerify?: typeof verifyChapaTransfer
): Promise<ReconcileSummary> {
  const cutoff = new Date(Date.now() - SETTLE_AFTER_MS);
  const pending = await db.payout.findMany({
    where: {
      transferStatus: "PENDING",
      transferReference: { not: null },
      transferAttemptedAt: { lt: cutoff },
    },
    select: {
      id: true,
      ownerId: true,
      currency: true,
      netPaidAmount: true,
      transferReference: true,
      campaign: { select: { title: true } },
    },
    // Oldest first: a transfer that has been unresolved longest is the one
    // someone is most likely waiting on.
    orderBy: { transferAttemptedAt: "asc" },
    take: 50,
  });

  const summary: ReconcileSummary = {
    checked: 0,
    settledPaid: 0,
    settledFailed: 0,
    stillPending: 0,
  };

  const verify = injectedVerify ?? verifyChapaTransfer;

  for (const p of pending) {
    if (!p.transferReference) continue;
    summary.checked += 1;

    let result: TransferResult;
    try {
      result = await verify(p.transferReference);
    } catch (e) {
      // A thrown verify tells us nothing about the transfer. Leave it alone and
      // try again next run — the whole point is that unresolved stays unresolved
      // until Chapa says otherwise.
      console.error(`reconcile: verify threw for ${p.transferReference}`, e);
      summary.stillPending += 1;
      continue;
    }

    if (result.outcome === "PENDING" || result.outcome === "UNKNOWN") {
      summary.stillPending += 1;
      continue;
    }

    // Recorded through the same function the send path uses, so a transfer
    // settled here is indistinguishable from one settled immediately — including
    // the fundraiser's notification, which they get now rather than never.
    await recordTransferOutcome({
      payoutId: p.id,
      ownerId: p.ownerId,
      campaignTitle: p.campaign?.title ?? "your campaign",
      reference: p.transferReference,
      net: toNumber(p.netPaidAmount ?? 0),
      currency: p.currency,
      // No human made this decision, so no actor is claimed. An audit entry
      // attributed to an admin who was asleep is worse than an unattributed one.
      adminId: null,
      result,
    });

    if (result.outcome === "SUCCESS") summary.settledPaid += 1;
    else summary.settledFailed += 1;
  }

  return summary;
}

export type Mismatch = {
  payoutId: string;
  kind: "paid_without_transfer" | "transferred_not_paid" | "stuck_pending";
  detail: string;
};

/**
 * Contradictions between our ledger and the provider's.
 *
 * Deliberately reports rather than repairs. Every one of these means two records
 * disagree about whether a real person has real money, and guessing which is
 * right is exactly the instinct that turns a discrepancy into a loss. A human
 * looks, then decides.
 */
export async function findLedgerMismatches(): Promise<Mismatch[]> {
  const stuckCutoff = new Date(Date.now() - STUCK_AFTER_MS);
  const out: Mismatch[] = [];

  // PAID, but the bank never confirmed it. Expected for historical payouts an
  // admin transferred by hand before any of this existed — those have no
  // transferStatus at all and are excluded, so this only catches payouts that
  // went through the new path and then disagreed.
  const paidWithout = await db.payout.findMany({
    where: {
      status: "PAID",
      transferStatus: { in: ["PENDING", "FAILED"] },
    },
    select: { id: true, transferStatus: true, transferReference: true },
    take: 100,
  });
  for (const p of paidWithout) {
    out.push({
      payoutId: p.id,
      kind: "paid_without_transfer",
      detail: `Marked PAID but the transfer is ${p.transferStatus} (${p.transferReference ?? "no reference"}). Either the money did not move, or it moved and the record is wrong.`,
    });
  }

  // The bank says it went, our ledger does not say paid. The fundraiser has the
  // money and the platform thinks it still owes them.
  const transferredNotPaid = await db.payout.findMany({
    where: { transferStatus: "SUCCESS", status: { not: "PAID" } },
    select: { id: true, status: true, transferReference: true },
    take: 100,
  });
  for (const p of transferredNotPaid) {
    out.push({
      payoutId: p.id,
      kind: "transferred_not_paid",
      detail: `Chapa confirmed the transfer (${p.transferReference ?? "no reference"}) but the payout is ${p.status}. The fundraiser has been paid and the ledger does not agree.`,
    });
  }

  // Unresolved for a day. Chapa is not going to answer on its own.
  const stuck = await db.payout.findMany({
    where: {
      transferStatus: "PENDING",
      transferAttemptedAt: { lt: stuckCutoff },
    },
    select: { id: true, transferReference: true, transferAttemptedAt: true },
    take: 100,
  });
  for (const p of stuck) {
    out.push({
      payoutId: p.id,
      kind: "stuck_pending",
      detail: `Unconfirmed since ${p.transferAttemptedAt?.toISOString() ?? "unknown"} (${p.transferReference ?? "no reference"}). Check it in the Chapa dashboard — do NOT re-send.`,
    });
  }

  return out;
}

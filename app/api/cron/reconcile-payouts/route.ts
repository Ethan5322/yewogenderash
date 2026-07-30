import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import {
  reconcilePendingTransfers,
  findLedgerMismatches,
} from "@/lib/payout-reconcile";
import { chapaTransfersEnabled } from "@/lib/chapa";
import { writeAudit } from "@/lib/audit";

export const runtime = "nodejs";
// Never cached: it writes, and a cached response would report a stale run as a
// fresh one.
export const dynamic = "force-dynamic";

/**
 * Settle transfers whose outcome we never learned, and report any place where our
 * ledger and Chapa's disagree.
 *
 * This endpoint is the other half of the send path. sendPayoutTransfer
 * deliberately leaves a transfer PENDING when the outcome is unclear — the
 * alternatives being to pay twice or to tell a fundraiser they were paid when
 * they may not have been — and this is what comes back and resolves them.
 *
 * Schedule it hourly (Vercel cron, or any scheduler that can send a header).
 * It never sends a transfer: it only asks Chapa what happened and records the
 * answer.
 */
export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    // Refusing is the safe default. An unsecured endpoint that writes payout
    // state is worse than one that does not run.
    return NextResponse.json(
      { error: "CRON_SECRET is not configured; refusing to run." },
      { status: 503 }
    );
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`; a plain
  // `x-cron-secret` header is accepted so any scheduler can drive it.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const header = req.headers.get("x-cron-secret") ?? "";
  const supplied = bearer || header;

  // Constant-time compare: a `!==` on a secret leaks its length and prefix to
  // anyone patient enough to measure.
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // Mismatches are worth reporting even with transfers switched off: they cover
  // historical records too, and a disagreement does not stop mattering because
  // the feature is disabled.
  const mismatches = await findLedgerMismatches();

  const summary = chapaTransfersEnabled()
    ? await reconcilePendingTransfers()
    : { checked: 0, settledPaid: 0, settledFailed: 0, stillPending: 0 };

  // Anything settled, or any disagreement, belongs in the audit log — this job
  // changes payout state with no human in the room, so the record is the only
  // account of what it did.
  if (summary.settledPaid || summary.settledFailed || mismatches.length) {
    await writeAudit({
      actorId: null,
      action: "PAYOUT_RECONCILIATION_RUN",
      entityType: "Payout",
      // No entityId: this entry is about the RUN, not one payout. The individual
      // payouts each get their own entry from recordTransferOutcome.
      detail: {
        ...summary,
        mismatches: mismatches.map((m) => ({ payoutId: m.payoutId, kind: m.kind })),
      },
    });
  }

  return NextResponse.json({
    ok: true,
    transfersEnabled: chapaTransfersEnabled(),
    ...summary,
    mismatches,
  });
}

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import { sendPayoutTransfer, TRANSFER_BLOCKED } from "@/lib/payout-transfer";
import { reconcilePendingTransfers, findLedgerMismatches } from "@/lib/payout-reconcile";
import type { TransferResult } from "@/lib/chapa";

/**
 * The send path and reconciliation, against a real database, with Chapa faked.
 *
 * These are the tests the whole phase exists for. The arithmetic was proven in
 * lib/fees.test.ts and the ledger plumbing in lib/payouts.integration.test.ts;
 * what remains is the part that cannot be undone — an instruction to move money
 * to a real person's bank.
 *
 * The case that matters most is the FOURTH one: the request times out, we never
 * learn the outcome, and the system must neither claim it was paid nor allow
 * anyone to send it again. Every other test here is scaffolding around that.
 *
 * Chapa is never contacted: the transfer function is injected. Same safety rails
 * as the other integration suite — an explicit opt-in and a localhost database.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  process.env.INTEGRATION_DB === "1" &&
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  !/supabase/i.test(url);

const sfx = Math.random().toString(36).slice(2, 10);
const userId = `tt-user-${sfx}`;
const ownerId = `tt-owner-${sfx}`;
const campaignId = `tt-camp-${sfx}`;
const accountId = `tt-acct-${sfx}`;
let payoutId = "";

/** A stand-in for Chapa that returns whatever a test needs. */
const chapaReturning = (result: TransferResult) => async () => result;

/** A stand-in that fails the way a dead connection does. */
const chapaThatThrows = () => async () => {
  throw new Error("socket hang up");
};

const SUCCESS: TransferResult = {
  outcome: "SUCCESS",
  transferId: "chapa-xfer-1",
  raw: { status: "success", data: { status: "success", transfer_id: "chapa-xfer-1" } },
};
const REFUSED: TransferResult = {
  outcome: "FAILED",
  transferId: null,
  raw: { status: "failed", message: "Invalid account number" },
  error: "Invalid account number",
};
const UNRESOLVED: TransferResult = {
  outcome: "UNKNOWN",
  transferId: null,
  raw: { transportError: "socket hang up" },
  error: "Could not confirm the transfer — its outcome is unknown.",
};

/** Recreate an APPROVED payout with no transfer attempt yet. */
async function freshPayout() {
  await db.payout.deleteMany({ where: { campaignId } });
  const p = await db.payout.create({
    data: {
      campaignId,
      ownerId,
      amount: 1697.5,
      netPaidAmount: 1575,
      withholdingFee: 122.5,
      currency: "ETB",
      status: "APPROVED",
      payoutAccountId: accountId,
    },
    select: { id: true },
  });
  payoutId = p.id;
  return p.id;
}

const load = () =>
  db.payout.findUniqueOrThrow({
    where: { id: payoutId },
    select: {
      status: true,
      transferStatus: true,
      transferReference: true,
      chapaTransferId: true,
      transferFailureReason: true,
      paidAt: true,
      payoutReference: true,
    },
  });

describe.skipIf(!isLocal)("payout transfers against a real database", () => {
  beforeAll(async () => {
    process.env.CHAPA_TRANSFERS_ENABLED = "true";
    // A live-shaped key, because the send path refuses test keys outright. No
    // request ever leaves — the transfer function is injected — so this only
    // satisfies the gate.
    process.env.CHAPA_SECRET_KEY = "CHASECK-integration-test";
    await db.user.create({
      data: {
        id: userId,
        name: "Transfer Test",
        email: `${userId}@test.local`,
        passwordHash: "x",
        role: "OWNER",
      },
    });
    await db.campaignOwner.create({ data: { id: ownerId, userId } });
    await db.campaign.create({
      data: {
        id: campaignId,
        ownerId,
        title: "Transfer test campaign",
        slug: campaignId,
        description: "d",
        category: "MEDICAL",
        targetAmount: 10000,
        queryCode: `TT-${sfx}`.slice(0, 12),
        status: "COMPLETED",
      },
    });
    await db.payoutAccount.create({
      data: {
        id: accountId,
        ownerId,
        accountName: "Test Owner",
        bankName: "Test Bank",
        bankCode: "001",
        accountNumber: "1000123456",
        isVerified: true,
        isDefault: true,
      },
    });
  });

  beforeEach(async () => {
    await freshPayout();
    // Messages too, not just the payout. Without this, test 4's "the fundraiser
    // is told nothing" assertion found test 1's success message and failed — the
    // code was right and the test was reading another test's output, which is the
    // most misleading kind of red.
    await db.message.deleteMany({ where: { ownerId } });
  });

  afterAll(async () => {
    if (!isLocal) return;
    await db.message.deleteMany({ where: { ownerId } });
    await db.auditLog.deleteMany({ where: { entityType: "Payout" } });
    await db.payout.deleteMany({ where: { campaignId } });
    await db.payoutAccount.deleteMany({ where: { ownerId } });
    await db.campaign.deleteMany({ where: { id: campaignId } });
    await db.campaignOwner.deleteMany({ where: { id: ownerId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("1. a confirmed transfer marks the payout paid and tells the fundraiser", async () => {
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(res).toEqual({ ok: true, outcome: "SUCCESS" });

    const p = await load();
    expect(p.transferStatus).toBe("SUCCESS");
    expect(p.status).toBe("PAID");
    expect(p.chapaTransferId).toBe("chapa-xfer-1");
    expect(p.paidAt).not.toBeNull();
    // The reference we generated is recorded as the payout reference, so the
    // ledger and Chapa can be matched later by one value.
    expect(p.payoutReference).toBe(p.transferReference);

    const msg = await db.message.findFirst({
      where: { ownerId, fromAdmin: true },
      orderBy: { createdAt: "desc" },
    });
    expect(msg?.subject).toContain("Withdrawal sent");
    expect(msg?.body).toContain(p.transferReference!);
  });

  it("2. a refused transfer does NOT mark it paid, and says the funds are safe", async () => {
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(REFUSED));
    expect(res.ok).toBe(false);

    const p = await load();
    expect(p.transferStatus).toBe("FAILED");
    // Still APPROVED, not REJECTED: the bank refused, which is not a judgement
    // about the fundraiser.
    expect(p.status).toBe("APPROVED");
    expect(p.paidAt).toBeNull();
    expect(p.transferFailureReason).toContain("Invalid account number");

    const msg = await db.message.findFirst({
      where: { ownerId, fromAdmin: true },
      orderBy: { createdAt: "desc" },
    });
    expect(msg?.body).toContain("Your funds are safe");
  });

  it("3. a payout already attempted cannot be sent again", async () => {
    await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    const second = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(second).toEqual({ ok: false, error: TRANSFER_BLOCKED.not_approved });
  });

  it("4. AN UNCONFIRMED TRANSFER IS NOT PAID, NOT FAILED, AND CANNOT BE RE-SENT", async () => {
    // The case the entire design exists for. The instruction may have reached
    // Chapa. Claiming failure invites a retry that pays twice; claiming success
    // tells a fundraiser they have money they may not have.
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(UNRESOLVED));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.outcome).toBe("PENDING");

    const p = await load();
    expect(p.transferStatus).toBe("PENDING");
    expect(p.status).toBe("APPROVED"); // NOT paid
    expect(p.paidAt).toBeNull();
    expect(p.transferReference).toBeTruthy(); // evidence survives

    // Nothing is told to the fundraiser, because nothing is known.
    const msg = await db.message.findFirst({ where: { ownerId, fromAdmin: true } });
    expect(msg).toBeNull();

    // And it is now locked against a second attempt.
    const again = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(again).toEqual({ ok: false, error: TRANSFER_BLOCKED.already_attempted });
  });

  it("5. a thrown transfer leaves it PENDING rather than crashing the payout", async () => {
    // sendPayoutTransfer does not catch — the injected function throwing models a
    // bug rather than a network failure — so the claim must already be committed
    // by the time it happens. That is what makes the reference recoverable.
    await expect(
      sendPayoutTransfer(payoutId, "admin-1", chapaThatThrows())
    ).rejects.toThrow();

    const p = await load();
    expect(p.transferStatus).toBe("PENDING");
    expect(p.transferReference).toBeTruthy();
    expect(p.status).toBe("APPROVED");
  });

  it("6. reconciliation settles an unconfirmed transfer once Chapa answers", async () => {
    await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(UNRESOLVED));
    // Backdate past the grace period, which exists so a transfer still in flight
    // is not chased a second later.
    await db.payout.update({
      where: { id: payoutId },
      data: { transferAttemptedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const summary = await reconcilePendingTransfers(async () => SUCCESS);
    expect(summary.checked).toBe(1);
    expect(summary.settledPaid).toBe(1);

    const p = await load();
    expect(p.transferStatus).toBe("SUCCESS");
    expect(p.status).toBe("PAID");

    // The fundraiser is told now — late, but told.
    const msg = await db.message.findFirst({
      where: { ownerId, fromAdmin: true },
      orderBy: { createdAt: "desc" },
    });
    expect(msg?.subject).toContain("Withdrawal sent");
  });

  it("7. reconciliation leaves it alone while Chapa still says pending", async () => {
    await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(UNRESOLVED));
    await db.payout.update({
      where: { id: payoutId },
      data: { transferAttemptedAt: new Date(Date.now() - 10 * 60 * 1000) },
    });

    const summary = await reconcilePendingTransfers(async () => ({
      outcome: "PENDING",
      transferId: null,
      raw: { data: { status: "pending" } },
    }));
    expect(summary.stillPending).toBe(1);
    expect(summary.settledPaid).toBe(0);
    expect((await load()).status).toBe("APPROVED");
  });

  it("8. reconciliation ignores transfers inside the grace period", async () => {
    await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(UNRESOLVED));
    // transferAttemptedAt is "now", so it must not be chased yet.
    const summary = await reconcilePendingTransfers(async () => SUCCESS);
    expect(summary.checked).toBe(0);
    expect((await load()).transferStatus).toBe("PENDING");
  });

  it("9. a stuck transfer is reported as a mismatch, not silently fixed", async () => {
    await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(UNRESOLVED));
    await db.payout.update({
      where: { id: payoutId },
      data: { transferAttemptedAt: new Date(Date.now() - 48 * 60 * 60 * 1000) },
    });

    const mismatches = await findLedgerMismatches();
    const mine = mismatches.filter((m) => m.payoutId === payoutId);
    expect(mine).toHaveLength(1);
    expect(mine[0].kind).toBe("stuck_pending");
    expect(mine[0].detail).toContain("do NOT re-send");
    // Reported only — the row is untouched.
    expect((await load()).transferStatus).toBe("PENDING");
  });

  it("10. a payout above the ceiling is refused before anything is claimed", async () => {
    await db.platformSettings.upsert({
      where: { id: "singleton" },
      create: { id: "singleton", maxAutoTransferEtb: 100 },
      update: { maxAutoTransferEtb: 100 },
    });
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(res.ok).toBe(false);

    const p = await load();
    // Nothing claimed, so it stays sendable by hand and re-sendable once the
    // ceiling is raised.
    expect(p.transferStatus).toBeNull();
    expect(p.transferReference).toBeNull();

    await db.platformSettings.update({
      where: { id: "singleton" },
      data: { maxAutoTransferEtb: 25000 },
    });
  });

  it("11. transfers are refused entirely when the feature flag is off", async () => {
    process.env.CHAPA_TRANSFERS_ENABLED = "false";
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(res).toEqual({ ok: false, error: TRANSFER_BLOCKED.disabled });
    expect((await load()).transferStatus).toBeNull();
    process.env.CHAPA_TRANSFERS_ENABLED = "true";
  });

  it("12. a TEST key cannot send, even with everything else in place", async () => {
    // The dangerous case, and the reason this gate exists. A simulated transfer
    // would come back SUCCESS, mark the payout PAID, tell the fundraiser their
    // money had been sent and consume the campaign's only withdrawal — with
    // nothing having moved. The injected function below WOULD have returned
    // success, so this test only passes if the key check refuses first.
    process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-pretend";
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(res).toEqual({ ok: false, error: TRANSFER_BLOCKED.test_mode });

    const p = await load();
    expect(p.status).toBe("APPROVED"); // not paid
    expect(p.transferStatus).toBeNull(); // nothing even claimed
    expect(p.transferReference).toBeNull();

    process.env.CHAPA_SECRET_KEY = "CHASECK-integration-test";
  });

  it("13. an unrecognisable key is refused too — unknown is not live", async () => {
    process.env.CHAPA_SECRET_KEY = "something-else-entirely";
    const res = await sendPayoutTransfer(payoutId, "admin-1", chapaReturning(SUCCESS));
    expect(res).toEqual({ ok: false, error: TRANSFER_BLOCKED.test_mode });
    expect((await load()).transferStatus).toBeNull();
    process.env.CHAPA_SECRET_KEY = "CHASECK-integration-test";
  });
});

describe.skipIf(isLocal)("payout transfer integration tests", () => {
  it("skipped — needs INTEGRATION_DB=1 and a local database", () => {
    expect(isLocal).toBe(false);
  });
});

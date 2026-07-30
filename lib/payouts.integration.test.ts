import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  campaignAvailableBalance,
  campaignWithholdingDue,
  campaignWithdrawEligibility,
  quoteWithdrawal,
} from "@/lib/payouts";
import {
  computeFeeSplit,
  withdrawableMax,
  grossUpForWithholding,
  withholdingTotalFor,
  PLATFORM_FEE_RATE,
  WITHHOLDING_FEE_RATE,
} from "@/lib/fees";
import { toNumber } from "@/lib/format";

/**
 * The withdrawal path, end to end, against a real Postgres.
 *
 * lib/fees.test.ts already proves the arithmetic. This proves the PLUMBING, and
 * every real bug found on 2026-07-29 was plumbing: the wrong field stored, a
 * balance that stayed withdrawable after being paid, a check that was not
 * atomic. None of those show up in a unit test of a pure function, and all of
 * them are about money.
 *
 * SAFETY: needs an explicit opt-in AND a localhost URL. This test writes and
 * deletes rows; against the shared Supabase project that would be destructive.
 * Skipped, not failed, otherwise, so `npm test` and CI stay green.
 *
 *   node scripts/local-db.mjs 5441
 *   INTEGRATION_DB=1 DATABASE_URL=postgresql://postgres:localdev@127.0.0.1:5441/yewogen npm test
 *
 * The opt-in flag is not belt-and-braces: vitest.config.ts falls back to a DUMMY
 * url on localhost so pure-logic tests can import modules that build a Prisma
 * client. A host check alone read that dummy as a real local database and tried
 * to run against nothing, which failed the whole suite. The flag is the only
 * signal that cannot be produced by accident.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  process.env.INTEGRATION_DB === "1" &&
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  !/supabase/i.test(url);

const suffix = Math.random().toString(36).slice(2, 10);
const userId = `itest-user-${suffix}`;
const ownerId = `itest-owner-${suffix}`;
const campaignId = `itest-camp-${suffix}`;

/** One donation, split the way the donation webhook splits it. */
async function donate(amount: number, n: number) {
  const split = computeFeeSplit(amount);
  await db.donation.create({
    data: {
      campaignId,
      amount: split.gross,
      platformFee: split.fee,
      netAmount: split.net,
      feeRate: split.rate,
      txRef: `itest-tx-${suffix}-${n}`,
      status: "SUCCESS",
      paidAt: new Date(),
    },
  });
}

describe.skipIf(!isLocal)("withdrawal path against a real database", () => {
  beforeAll(async () => {
    await db.user.create({
      data: {
        id: userId,
        name: "Integration Test",
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
        title: "Integration test campaign",
        slug: campaignId,
        description: "desc",
        category: "MEDICAL",
        targetAmount: 10_000,
        queryCode: `IT-${suffix}`.slice(0, 12),
        // Closed, because withdrawal requires it.
        status: "COMPLETED",
      },
    });
    // 1,000 + 500 + 250 = 1,750 gross, arriving separately like real donations.
    await donate(1000, 1);
    await donate(500, 2);
    await donate(250, 3);
  });

  afterAll(async () => {
    if (!isLocal) return;
    await db.payout.deleteMany({ where: { campaignId } });
    await db.donation.deleteMany({ where: { campaignId } });
    await db.campaign.deleteMany({ where: { id: campaignId } });
    await db.campaignOwner.deleteMany({ where: { id: ownerId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  const GROSS = 1750;

  it("shows the fundraiser 97% of what donors gave", async () => {
    const available = await campaignAvailableBalance(campaignId);
    expect(available).toBe(GROSS * (1 - PLATFORM_FEE_RATE)); // 1697.5
  });

  it("owes 7% of gross in withholding, none of it charged yet", async () => {
    const { total, charged, due } = await campaignWithholdingDue(campaignId);
    // Compared against the real helper, not `GROSS * 0.07`. In floating point
    // 1750 * 0.07 is 122.50000000000001, and the platform rounds to birr cents
    // — the first version of this test asserted the unrounded value and failed,
    // which is the rounding in fees.ts working exactly as intended.
    expect(total).toBe(withholdingTotalFor(GROSS)); // 122.5
    expect(charged).toBe(0);
    expect(due).toBe(total);
  });

  it("caps the withdrawal at exactly 90% of gross", async () => {
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    expect(withdrawableMax(available, due)).toBe(GROSS * 0.9); // 1575
  });

  it("allows the withdrawal, and prices it so the net equals the cap", async () => {
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    const max = withdrawableMax(available, due);

    await expect(
      campaignWithdrawEligibility(campaignId, "COMPLETED", max)
    ).resolves.toEqual({ ok: true });

    const quote = await quoteWithdrawal(campaignId, grossUpForWithholding(max, due));
    expect(quote.net).toBe(max); // the fundraiser receives the full 1575
    expect(quote.withholding).toBe(due);
    expect(quote.requested).toBe(max + due); // 1697.5 leaves the ledger
  });

  it("leaves the balance at zero once the payout is recorded", async () => {
    // The regression that matters. payout.amount is the field
    // campaignAvailableBalance subtracts; storing the NET there instead of the
    // grossed-up figure left the withholding portion looking withdrawable
    // forever — a phantom balance that, under one-withdrawal-per-campaign,
    // nobody could ever claim.
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    const max = withdrawableMax(available, due);
    const quote = await quoteWithdrawal(campaignId, grossUpForWithholding(max, due));

    await db.payout.create({
      data: {
        campaignId,
        ownerId,
        amount: quote.requested,
        withholdingFee: quote.withholding,
        netPaidAmount: quote.net,
        status: "REQUESTED",
      },
    });

    expect(await campaignAvailableBalance(campaignId)).toBe(0);
    const after = await campaignWithholdingDue(campaignId);
    expect(after.charged).toBe(due);
    expect(after.due).toBe(0); // charged once, never again
  });

  it("refuses a second withdrawal while the first is in flight", async () => {
    const max = withdrawableMax(
      await campaignAvailableBalance(campaignId),
      (await campaignWithholdingDue(campaignId)).due
    );
    await expect(
      campaignWithdrawEligibility(campaignId, "COMPLETED", max)
    ).resolves.toEqual({ ok: false, reason: "in_progress" });
  });

  it("refuses forever once paid, and the fundraiser has received exactly 90%", async () => {
    await db.payout.updateMany({
      where: { campaignId },
      data: { status: "PAID", paidAt: new Date() },
    });

    await expect(
      campaignWithdrawEligibility(campaignId, "COMPLETED", 0)
    ).resolves.toEqual({ ok: false, reason: "already_withdrawn" });

    const paid = await db.payout.aggregate({
      where: { campaignId, status: "PAID" },
      _sum: { netPaidAmount: true },
    });
    expect(toNumber(paid._sum.netPaidAmount ?? 0)).toBe(GROSS * 0.9);
  });

  it("restores the balance and the slot when a payout is rejected", async () => {
    await db.payout.updateMany({ where: { campaignId }, data: { status: "REJECTED" } });

    // Rejected payouts are excluded from both the reservation and the
    // withholding-charged total, so the campaign returns to its pre-request
    // state rather than losing the money to a refused request.
    const available = await campaignAvailableBalance(campaignId);
    expect(available).toBe(GROSS * (1 - PLATFORM_FEE_RATE));

    const { due, charged } = await campaignWithholdingDue(campaignId);
    expect(charged).toBe(0);
    expect(due).toBe(withholdingTotalFor(GROSS));

    await expect(
      campaignWithdrawEligibility(campaignId, "COMPLETED", withdrawableMax(available, due))
    ).resolves.toEqual({ ok: true });
  });

  it("refuses while the campaign is still collecting, whatever the balance", async () => {
    await expect(
      campaignWithdrawEligibility(campaignId, "ACTIVE", 1575)
    ).resolves.toEqual({ ok: false, reason: "not_closed" });
  });
});

describe.skipIf(isLocal)("withdrawal integration tests", () => {
  it("skipped — set DATABASE_URL to a local throwaway database to run them", () => {
    expect(isLocal).toBe(false);
  });
});

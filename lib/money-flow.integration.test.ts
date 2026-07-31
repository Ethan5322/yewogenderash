import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "@/lib/db";
import { computeFeeSplit, withdrawableMax, grossUpForWithholding } from "@/lib/fees";
import {
  campaignAvailableBalance,
  campaignWithholdingDue,
  campaignWithdrawEligibility,
  quoteWithdrawal,
} from "@/lib/payouts";
import { sendPayoutTransfer } from "@/lib/payout-transfer";
import { findLedgerMismatches } from "@/lib/payout-reconcile";
import { toNumber } from "@/lib/format";
import type { TransferResult } from "@/lib/chapa";

/**
 * ONE test that follows real money from a donor's card to a fundraiser's bank.
 *
 * The other suites each prove a link: fees.test.ts the arithmetic,
 * payouts.integration.test.ts the ledger, payout-transfer.integration.test.ts the
 * send path. Every link passing does not prove the CHAIN holds — that is exactly
 * where a units mismatch or a stale denormalised column hides, because each end
 * of the join is individually correct.
 *
 * So this walks the whole thing once and checks the money is conserved at every
 * step: donors give 3,000, the platform keeps 300 (3%), the fundraiser sees 2,700,
 * withdraws a ceiling of 2,700 - 210 = 2,490... and the numbers must add up to the
 * last birr with nothing invented or lost.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  process.env.INTEGRATION_DB === "1" &&
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  !/supabase/i.test(url);

const sfx = Math.random().toString(36).slice(2, 10);
const userId = `mf-user-${sfx}`;
const ownerId = `mf-owner-${sfx}`;
const campaignId = `mf-camp-${sfx}`;
const accountId = `mf-acct-${sfx}`;

/** What donors give, in three separate gifts. */
const GIFTS = [1000, 1500, 500];
const GROSS = 3000;

const SUCCESS: TransferResult = {
  outcome: "SUCCESS",
  transferId: "chapa-mf-1",
  raw: { data: { status: "success" } },
};

/**
 * Settle a donation exactly as lib/donations.ts does.
 *
 * Mirrored rather than called because settleDonation() verifies with Chapa over
 * the network first. The point here is the LEDGER writes, and they are copied
 * field for field — including the CampaignBalance denorm, so the drift this test
 * asserts on is the real behaviour and not an artefact of the fixture.
 */
async function settle(amount: number, i: number) {
  const split = computeFeeSplit(amount);
  const donation = await db.donation.create({
    data: {
      campaignId,
      amount,
      currency: "ETB",
      txRef: `mf-${sfx}-${i}`,
      status: "SUCCESS",
      paidAt: new Date(),
      platformFee: split.fee,
      netAmount: split.net,
      feeRate: split.rate,
    },
  });
  await db.campaign.update({
    where: { id: campaignId },
    data: { currentAmount: { increment: amount } },
  });
  await db.feeLedger.create({
    data: {
      donationId: donation.id,
      campaignId,
      grossAmount: split.gross,
      feeAmount: split.fee,
      netAmount: split.net,
      feeRate: split.rate,
      currency: "ETB",
    },
  });
  await db.campaignBalance.upsert({
    where: { campaignId },
    create: {
      campaignId,
      grossRaised: split.gross,
      totalFees: split.fee,
      netRaised: split.net,
      availableAmount: split.net,
      currency: "ETB",
    },
    update: {
      grossRaised: { increment: split.gross },
      totalFees: { increment: split.fee },
      netRaised: { increment: split.net },
      availableAmount: { increment: split.net },
    },
  });
  return split;
}

describe.skipIf(!isLocal)("money from donor to bank", () => {
  beforeAll(async () => {
    process.env.CHAPA_TRANSFERS_ENABLED = "true";
    process.env.CHAPA_SECRET_KEY = "CHASECK-integration-test";
    await db.user.create({
      data: {
        id: userId,
        name: "Flow Test",
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
        title: "Money flow campaign",
        slug: campaignId,
        description: "d",
        category: "MEDICAL",
        targetAmount: 5000,
        queryCode: `MF-${sfx}`.slice(0, 12),
        status: "ACTIVE",
      },
    });
    await db.payoutAccount.create({
      data: {
        id: accountId,
        ownerId,
        accountName: "Flow Test",
        bankName: "Test Bank",
        bankCode: "001",
        accountNumber: "1000999888",
        isVerified: true,
        isDefault: true,
      },
    });
    for (const [i, amount] of GIFTS.entries()) await settle(amount, i);
  });

  afterAll(async () => {
    if (!isLocal) return;
    await db.message.deleteMany({ where: { ownerId } });
    await db.notification.deleteMany({ where: { ownerId } });
    await db.payout.deleteMany({ where: { campaignId } });
    await db.feeLedger.deleteMany({ where: { campaignId } });
    await db.campaignBalance.deleteMany({ where: { campaignId } });
    await db.donation.deleteMany({ where: { campaignId } });
    await db.payoutAccount.deleteMany({ where: { ownerId } });
    await db.campaign.deleteMany({ where: { id: campaignId } });
    await db.campaignOwner.deleteMany({ where: { id: ownerId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  it("1. donations show as money on the public campaign", async () => {
    // currentAmount is the "raised" figure donors see, and it tracks GROSS — what
    // was given, not what survives the fee. A donor who gave 1,000 should see
    // their 1,000 reflected, not 970.
    const c = await db.campaign.findUniqueOrThrow({
      where: { id: campaignId },
      select: { currentAmount: true },
    });
    expect(toNumber(c.currentAmount)).toBe(GROSS);
  });

  it("2. the fee ledger accounts for every birr, with none invented or lost", async () => {
    const rows = await db.feeLedger.findMany({ where: { campaignId } });
    expect(rows).toHaveLength(GIFTS.length);

    const gross = rows.reduce((n, r) => n + toNumber(r.grossAmount), 0);
    const fees = rows.reduce((n, r) => n + toNumber(r.feeAmount), 0);
    const net = rows.reduce((n, r) => n + toNumber(r.netAmount), 0);

    expect(gross).toBe(GROSS);
    expect(fees).toBe(90); // 3% of 3,000
    // The reconciliation that matters: fee + net is exactly gross, per row and in
    // total. computeFeeSplit derives net as gross − fee for this reason.
    expect(fees + net).toBe(gross);
  });

  it("3. the fundraiser is shown 97% — what they can actually count on", async () => {
    const available = await campaignAvailableBalance(campaignId);
    expect(available).toBe(2910); // 3,000 − 3%
  });

  it("4. the withdrawal ceiling is exactly 90% of what donors gave", async () => {
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    expect(due).toBe(210); // 7% of gross, charged once

    const max = withdrawableMax(available, due);
    expect(max).toBe(2700);
    expect(max).toBe(GROSS * 0.9); // the promise, stated as arithmetic
  });

  it("5. a live campaign cannot be withdrawn — the total is not final yet", async () => {
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    const max = withdrawableMax(available, due);
    const e = await campaignWithdrawEligibility(campaignId, "ACTIVE", max);
    expect(e).toEqual({ ok: false, reason: "not_closed" });
  });

  it("6. once closed, the full balance is withdrawable and priced to the birr", async () => {
    await db.campaign.update({
      where: { id: campaignId },
      data: { status: "COMPLETED" },
    });

    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    const max = withdrawableMax(available, due);

    const e = await campaignWithdrawEligibility(campaignId, "COMPLETED", max);
    expect(e).toEqual({ ok: true });

    // Grossing up charges the balance for net + withholding, and the net that
    // comes back must be the figure the fundraiser was shown. Not "about".
    const quote = await quoteWithdrawal(campaignId, grossUpForWithholding(max, due));
    expect(quote.requested).toBe(2910); // the whole 97% balance
    expect(quote.withholding).toBe(210);
    expect(quote.net).toBe(2700); // exactly the ceiling
  });

  it("7. transferring pays 90% of gross and empties the balance", async () => {
    const available = await campaignAvailableBalance(campaignId);
    const { due } = await campaignWithholdingDue(campaignId);
    const max = withdrawableMax(available, due);
    const quote = await quoteWithdrawal(campaignId, grossUpForWithholding(max, due));

    const payout = await db.payout.create({
      data: {
        campaignId,
        ownerId,
        amount: quote.requested,
        netPaidAmount: quote.net,
        withholdingFee: quote.withholding,
        currency: "ETB",
        status: "APPROVED",
        payoutAccountId: accountId,
      },
      select: { id: true },
    });

    const sent = await sendPayoutTransfer(payout.id, "admin-1", async () => SUCCESS);
    expect(sent).toEqual({ ok: true, outcome: "SUCCESS" });

    const p = await db.payout.findUniqueOrThrow({
      where: { id: payout.id },
      select: { status: true, netPaidAmount: true, transferStatus: true },
    });
    expect(p.status).toBe("PAID");
    expect(p.transferStatus).toBe("SUCCESS");
    expect(toNumber(p.netPaidAmount!)).toBe(2700);

    // Nothing left, and nothing owed twice.
    expect(await campaignAvailableBalance(campaignId)).toBe(0);
    expect((await campaignWithholdingDue(campaignId)).due).toBe(0);
  });

  it("8. the money adds up: 90% to the fundraiser, 10% to the platform", async () => {
    const paid = await db.payout.aggregate({
      where: { campaignId, status: "PAID" },
      _sum: { netPaidAmount: true, withholdingFee: true },
    });
    const fees = await db.feeLedger.aggregate({
      where: { campaignId },
      _sum: { feeAmount: true },
    });

    const toFundraiser = toNumber(paid._sum.netPaidAmount ?? 0);
    const transactionFee = toNumber(fees._sum.feeAmount ?? 0);
    const withholding = toNumber(paid._sum.withholdingFee ?? 0);

    expect(toFundraiser).toBe(2700); // 90%
    expect(transactionFee + withholding).toBe(300); // 10%
    // The whole point: every birr donors gave is accounted for, exactly.
    expect(toFundraiser + transactionFee + withholding).toBe(GROSS);
  });

  it("9. reconciliation finds nothing wrong with a clean flow", async () => {
    const mismatches = await findLedgerMismatches();
    expect(mismatches.filter((m) => m.payoutId)).toEqual(
      expect.not.arrayContaining([
        expect.objectContaining({ kind: "paid_without_transfer" }),
      ])
    );
  });

  it("10. KNOWN DRIFT: the CampaignBalance denorm is not decremented on payout", async () => {
    // Documenting a real defect rather than pretending it is not there.
    //
    // CampaignBalance.availableAmount is incremented per donation and decremented
    // on refund, but NOTHING touches it when a payout is made, and totalWithdrawn
    // is never written at all. So after a full withdrawal the denorm still claims
    // the whole net is available.
    //
    // It is not visible to anyone TODAY: every balance shown to a fundraiser or an
    // admin comes from campaignAvailableBalance(), which computes from donations
    // minus payouts. The denorm has no readers. That is precisely why it is
    // dangerous — it is a loaded number waiting for someone to trust it.
    const denorm = await db.campaignBalance.findUniqueOrThrow({
      where: { campaignId },
      select: { availableAmount: true, totalWithdrawn: true },
    });
    const computed = await campaignAvailableBalance(campaignId);

    expect(computed).toBe(0); // the truth
    expect(toNumber(denorm.availableAmount)).toBe(2910); // the stale copy
    expect(toNumber(denorm.totalWithdrawn)).toBe(0); // never written

    // When this is fixed — by maintaining it in the payout path or deleting the
    // table — this test should fail and be replaced by an equality assertion.
    expect(toNumber(denorm.availableAmount)).not.toBe(computed);
  });
});

describe.skipIf(isLocal)("money flow integration tests", () => {
  it("skipped — needs INTEGRATION_DB=1 and a local database", () => {
    expect(isLocal).toBe(false);
  });
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * campaignWithdrawEligibility decides whether a fundraiser may take their one
 * withdrawal. Getting it wrong in either direction is expensive: too loose and
 * a campaign can be drained twice, too strict and an honest fundraiser is
 * locked out of donor money with no way back except a developer.
 *
 * The db is mocked because these are decision rules, not queries — what matters
 * is which payout states block and which do not.
 */
const findFirst = vi.fn();
vi.mock("@/lib/db", () => ({
  db: { payout: { findFirst: (...a: unknown[]) => findFirst(...a) } },
}));

const { campaignWithdrawEligibility } = await import("@/lib/payouts");

beforeEach(() => {
  findFirst.mockReset();
  findFirst.mockResolvedValue(null); // no prior payout unless a test says so
});

describe("withdrawal eligibility — one per campaign, in full, after closing", () => {
  it("allows a closed campaign with a balance and no prior payout", async () => {
    await expect(campaignWithdrawEligibility("c1", "COMPLETED", 900)).resolves.toEqual({
      ok: true,
    });
  });

  it("refuses while the campaign is still ACTIVE", async () => {
    // The anti-stranding rule: withdrawing everything from a live campaign
    // would leave later donations permanently unreachable.
    await expect(campaignWithdrawEligibility("c1", "ACTIVE", 900)).resolves.toEqual({
      ok: false,
      reason: "not_closed",
    });
  });

  it("refuses for every non-closed status, not just ACTIVE", async () => {
    for (const status of ["DRAFT", "PENDING_REVIEW", "SUSPENDED", "REJECTED", "ARCHIVED"]) {
      await expect(campaignWithdrawEligibility("c1", status, 900)).resolves.toEqual({
        ok: false,
        reason: "not_closed",
      });
    }
  });

  it("refuses a second withdrawal once one has been PAID", async () => {
    findFirst.mockResolvedValue({ status: "PAID" });
    await expect(campaignWithdrawEligibility("c1", "COMPLETED", 900)).resolves.toEqual({
      ok: false,
      reason: "already_withdrawn",
    });
  });

  it("refuses a duplicate while one is still in flight", async () => {
    for (const status of ["REQUESTED", "APPROVED"]) {
      findFirst.mockResolvedValue({ status });
      await expect(campaignWithdrawEligibility("c1", "COMPLETED", 900)).resolves.toEqual({
        ok: false,
        reason: "in_progress",
      });
    }
  });

  it("does NOT count a rejected or cancelled payout against the one chance", async () => {
    // The query itself must exclude them — an admin rejection or a wrong bank
    // number must never permanently lock a fundraiser out of their own funds.
    await campaignWithdrawEligibility("c1", "COMPLETED", 900);
    const where = findFirst.mock.calls[0][0].where;
    expect(where.status.in).toEqual(["REQUESTED", "APPROVED", "PAID"]);
    expect(where.status.in).not.toContain("REJECTED");
    expect(where.status.in).not.toContain("CANCELLED");
  });

  it("scopes the check to the campaign it was asked about", async () => {
    await campaignWithdrawEligibility("campaign-42", "COMPLETED", 900);
    expect(findFirst.mock.calls[0][0].where.campaignId).toBe("campaign-42");
  });

  it("refuses when there is nothing to withdraw", async () => {
    for (const max of [0, -5]) {
      await expect(campaignWithdrawEligibility("c1", "COMPLETED", max)).resolves.toEqual({
        ok: false,
        reason: "nothing_available",
      });
    }
  });

  it("checks closure before touching the database", async () => {
    // An ACTIVE campaign is refused on status alone; no point querying payouts.
    await campaignWithdrawEligibility("c1", "ACTIVE", 900);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

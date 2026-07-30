import { describe, it, expect } from "vitest";
import { normaliseTransferStatus, type TransferOutcome } from "@/lib/chapa";

/**
 * The one function that decides whether a fundraiser has been paid.
 *
 * Chapa's published docs do not fully specify the verify response body, so this
 * mapping is the boundary between "what they said" and "what we are willing to
 * believe". The two possible mistakes are not equally expensive:
 *
 *   reading a success as unknown  → reconciliation asks again. Costs a query.
 *   reading anything as success   → the payout is closed, the fundraiser is told
 *                                   they were paid, and nobody looks again.
 *
 * So the rule is a whitelist, and everything else is UNKNOWN. These tests exist
 * to stop someone later "improving" it into a permissive default.
 */
describe("normaliseTransferStatus", () => {
  it("accepts the success spellings Chapa is known to use", () => {
    for (const s of ["success", "successful", "completed"]) {
      expect(normaliseTransferStatus(s)).toBe<TransferOutcome>("SUCCESS");
    }
  });

  it("accepts the failure spellings", () => {
    for (const s of ["failed", "failure", "cancelled", "canceled"]) {
      expect(normaliseTransferStatus(s)).toBe<TransferOutcome>("FAILED");
    }
  });

  it("accepts the in-progress spellings", () => {
    for (const s of ["pending", "queued", "processing", "new"]) {
      expect(normaliseTransferStatus(s)).toBe<TransferOutcome>("PENDING");
    }
  });

  it("ignores case and surrounding whitespace", () => {
    expect(normaliseTransferStatus("  SUCCESS  ")).toBe("SUCCESS");
    expect(normaliseTransferStatus("Failed")).toBe("FAILED");
    expect(normaliseTransferStatus("Pending\n")).toBe("PENDING");
  });

  it("treats anything it does not recognise as UNKNOWN, never as paid", () => {
    // A status Chapa adds later, a rename, a typo, a localised string, an
    // object, a number. None of these may ever read as SUCCESS.
    const strangers: unknown[] = [
      "reversed",
      "on_hold",
      "partially_completed",
      "SUCCES",
      "succeeded", // plausible, but not a spelling we have confirmed
      "done",
      "ok",
      "true",
      "",
      "   ",
      null,
      undefined,
      0,
      1,
      {},
      [],
      { status: "success" }, // a nested object is not a status string
      NaN,
    ];
    for (const s of strangers) {
      expect(normaliseTransferStatus(s), `${JSON.stringify(s)} must be UNKNOWN`).toBe(
        "UNKNOWN"
      );
    }
  });

  it("never returns SUCCESS for a value that merely contains the word", () => {
    // Substring matching would be a disaster here: "not successful" and
    // "success_pending" both contain "success".
    for (const s of ["not successful", "success_pending", "unsuccessful", "no success"]) {
      expect(normaliseTransferStatus(s)).not.toBe("SUCCESS");
    }
  });
});

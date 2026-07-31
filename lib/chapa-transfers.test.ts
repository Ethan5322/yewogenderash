import { describe, it, expect, afterEach } from "vitest";
import {
  normaliseTransferStatus,
  chapaKeyMode,
  type TransferOutcome,
} from "@/lib/chapa";

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

/**
 * Which key is configured, which is what decides whether the app may transfer at
 * all. The failure this guards against is subtle: a test-key transfer does not
 * error, it succeeds harmlessly at the bank while the ledger records a real
 * payment. So anything that is not demonstrably a live key must read as not-live.
 */
describe("chapaKeyMode", () => {
  const original = process.env.CHAPA_SECRET_KEY;
  afterEach(() => {
    if (original === undefined) delete process.env.CHAPA_SECRET_KEY;
    else process.env.CHAPA_SECRET_KEY = original;
  });

  it("recognises a test secret", () => {
    process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-abc123";
    expect(chapaKeyMode()).toBe("test");
  });

  it("recognises a live secret", () => {
    process.env.CHAPA_SECRET_KEY = "CHASECK-abc123";
    expect(chapaKeyMode()).toBe("live");
  });

  it("says unknown rather than guessing, and unknown must never mean live", () => {
    for (const key of ["", "sk_live_whatever", "PUBLIC-KEY", "chaseck-lowercase"]) {
      process.env.CHAPA_SECRET_KEY = key;
      expect(chapaKeyMode(), `${JSON.stringify(key)}`).not.toBe("live");
    }
    delete process.env.CHAPA_SECRET_KEY;
    expect(chapaKeyMode()).toBe("unknown");
  });

  it("does not mistake a test key for live because it starts with CHASECK", () => {
    // The live check is a bare CHASECK prefix, so the test branch must be tried
    // first. Getting this order wrong would arm transfers in test mode.
    process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-xyz";
    expect(chapaKeyMode()).not.toBe("live");
  });
});

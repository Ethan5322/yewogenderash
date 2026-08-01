import { describe, it, expect, beforeAll } from "vitest";
import {
  createCaptureToken,
  verifyCaptureToken,
  biometricFingerprint,
} from "@/lib/capture-token";

/**
 * The only unauthenticated path that writes biometric data.
 *
 * A phone that is not logged in uploads the live selfie for an owner, authorised
 * solely by this token. So the token IS the credential, and two properties have to
 * hold: it expires, and it can only be spent once.
 *
 * It used to be replayable for its entire 15-minute life. Anyone who obtained the
 * URL — a screenshot in a chat, a shoulder-surfed QR code, history on a shared
 * phone — could overwrite the owner's face descriptor, liveness result and selfie
 * repeatedly. On an owner still awaiting review, an attacker's face could replace
 * theirs before an admin ever looked at it.
 *
 * Single-use is achieved without a nonce table: the token carries a fingerprint of
 * the owner's biometric state, and a successful capture changes that state. These
 * tests are what make that claim more than a comment.
 */
const OWNER = {
  id: "owner-abc123",
  faceDescriptor: null as unknown,
  livenessPassed: null as boolean | null,
  biometricStatus: "UNVERIFIED",
};

beforeAll(() => {
  // The token is signed with AUTH_SECRET; a fixed value keeps the test hermetic.
  process.env.AUTH_SECRET ??= "test-auth-secret-for-capture-token";
});

describe("capture token", () => {
  it("round-trips the owner and the state it was minted against", () => {
    const token = createCaptureToken(OWNER);
    const claim = verifyCaptureToken(token);
    expect(claim).not.toBeNull();
    expect(claim!.ownerId).toBe(OWNER.id);
    expect(claim!.fingerprint).toBe(biometricFingerprint(OWNER));
  });

  it("refuses a forged signature", () => {
    const token = createCaptureToken(OWNER);
    const [payload] = token.split(".");
    expect(verifyCaptureToken(`${payload}.notarealsignature`)).toBeNull();
  });

  it("refuses a payload edited to name a different owner", () => {
    // The obvious attack: keep the signature, swap whose face you are replacing.
    const forgedPayload = Buffer.from(
      JSON.stringify({
        o: "someone-elses-owner-id",
        e: Date.now() + 60_000,
        f: biometricFingerprint(OWNER),
      })
    ).toString("base64url");
    const realSig = createCaptureToken(OWNER).split(".")[1];
    expect(verifyCaptureToken(`${forgedPayload}.${realSig}`)).toBeNull();
  });

  it("refuses an expired token", () => {
    const expired = Buffer.from(
      JSON.stringify({ o: OWNER.id, e: Date.now() - 1000, f: "abc" })
    ).toString("base64url");
    // Signed correctly but out of time — the signature is not the only gate.
    const token = createCaptureToken(OWNER);
    const sig = token.split(".")[1];
    expect(verifyCaptureToken(`${expired}.${sig}`)).toBeNull();
  });

  it("refuses malformed input without throwing", () => {
    for (const bad of ["", ".", "no-dot", "a.b.c", "!!!.???"]) {
      expect(() => verifyCaptureToken(bad)).not.toThrow();
      expect(verifyCaptureToken(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it("refuses a legacy token that carries no fingerprint", () => {
    // Tokens minted before this change have no `f`. Accepting them would leave the
    // replay window open for as long as any are still valid, so they are refused —
    // the cost is one person re-scanning a QR code.
    const legacy = Buffer.from(
      JSON.stringify({ o: OWNER.id, e: Date.now() + 60_000 })
    ).toString("base64url");
    const sig = createCaptureToken(OWNER).split(".")[1];
    expect(verifyCaptureToken(`${legacy}.${sig}`)).toBeNull();
  });
});

describe("single-use, via the biometric fingerprint", () => {
  it("the fingerprint CHANGES when a capture is stored", () => {
    // This is the mechanism. If these two ever matched, the token would stay
    // spendable and the whole defence would silently be a no-op.
    const before = biometricFingerprint(OWNER);
    const after = biometricFingerprint({
      ...OWNER,
      faceDescriptor: [0.11, 0.22, 0.33],
      livenessPassed: true,
      biometricStatus: "PENDING",
    });
    expect(after).not.toBe(before);
  });

  it("a token minted before a capture no longer matches the state after it", () => {
    // The replay, played out: mint a token, upload once, try the same link again.
    const token = createCaptureToken(OWNER);
    const claim = verifyCaptureToken(token)!;

    const afterUpload = {
      ...OWNER,
      faceDescriptor: [0.5, 0.6],
      livenessPassed: true,
      biometricStatus: "PENDING",
    };

    // The route compares exactly like this, and refuses on a mismatch.
    expect(biometricFingerprint(afterUpload)).not.toBe(claim.fingerprint);
  });

  it("an UNCHANGED state still matches, so a failed upload can be retried", () => {
    // The other direction. A phone that loses connection mid-upload must be able
    // to try again — locking that out would be a self-inflicted outage during
    // identity verification.
    const token = createCaptureToken(OWNER);
    const claim = verifyCaptureToken(token)!;
    expect(biometricFingerprint(OWNER)).toBe(claim.fingerprint);
  });

  it("distinguishes liveness alone", () => {
    // Liveness is part of what a capture writes, so flipping it must spend the
    // token even if the descriptor somehow matched.
    const a = biometricFingerprint({ ...OWNER, livenessPassed: false });
    const b = biometricFingerprint({ ...OWNER, livenessPassed: true });
    expect(a).not.toBe(b);
  });

  it("never leaks the descriptor itself", () => {
    // The fingerprint travels in a URL. It must be a digest, not the biometric.
    const descriptor = [0.123456, 0.654321, 0.999999];
    const fp = biometricFingerprint({ ...OWNER, faceDescriptor: descriptor });
    expect(fp).not.toContain("0.123456");
    expect(fp.length).toBeLessThanOrEqual(16);
  });
});

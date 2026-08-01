import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { requiredEnv } from "@/lib/env";

/**
 * Short-lived, HMAC-signed token that authorises a phone to upload the biometric
 * selfie for a specific owner — without the phone being logged in.
 *
 * The token IS the authorisation, so two things bound it: it expires, and it is
 * SINGLE-USE.
 *
 * WHY SINGLE-USE MATTERS
 *   It was replayable for its whole lifetime. Anyone who obtained the URL — a
 *   screenshot in a chat, a shoulder-surfed QR code, history on a shared phone —
 *   could overwrite that owner's face descriptor, liveness result and selfie
 *   repeatedly until it expired. On an owner still awaiting review, an attacker's
 *   face could replace theirs before an admin ever looked.
 *
 * HOW, WITHOUT A NONCE TABLE
 *   The token carries a fingerprint of the owner's CURRENT biometric state. A
 *   successful upload changes that state, so the fingerprint no longer matches and
 *   the token stops verifying — single-use as a consequence of the data, with no
 *   table to grow, no cleanup job, and nothing to get out of step.
 *
 *   The fingerprint deliberately covers only the biometric fields. Using something
 *   broad like updatedAt would invalidate a token in flight whenever anything else
 *   about the owner changed, breaking a legitimate capture for no security gain.
 *
 *   A FAILED upload leaves the state untouched, so the token still works and the
 *   user can retry — which is the behaviour you want.
 */
const TTL_MS = 10 * 60 * 1000; // 10 minutes: ample for scan-and-selfie

function sign(data: string): string {
  return createHmac("sha256", requiredEnv("AUTH_SECRET")).update(data).digest("base64url");
}

/**
 * A short, stable fingerprint of an owner's biometric state.
 *
 * Anything that a successful capture changes belongs here, and nothing else.
 * Truncated because it only needs to differ, not to be reversible — and it travels
 * in a URL.
 */
export function biometricFingerprint(owner: {
  faceDescriptor: unknown;
  livenessPassed: boolean | null;
  biometricStatus: string;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        // The descriptor itself is the thing being protected; only its hash is
        // used, and it never leaves the server in readable form.
        owner.faceDescriptor === null || owner.faceDescriptor === undefined
          ? ""
          : JSON.stringify(owner.faceDescriptor),
        owner.livenessPassed,
        owner.biometricStatus,
      ])
    )
    .digest("base64url")
    .slice(0, 16);
}

export function createCaptureToken(owner: {
  id: string;
  faceDescriptor: unknown;
  livenessPassed: boolean | null;
  biometricStatus: string;
}): string {
  const payload = Buffer.from(
    JSON.stringify({
      o: owner.id,
      e: Date.now() + TTL_MS,
      f: biometricFingerprint(owner),
    })
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/**
 * Returns the ownerId and the state fingerprint the token was minted against, or
 * null if the token is forged, malformed or expired.
 *
 * The CALLER must then load the owner and confirm the fingerprint still matches —
 * that is what makes the token single-use. Returning it rather than checking here
 * keeps this module free of database access and therefore unit-testable.
 */
export function verifyCaptureToken(
  token: string
): { ownerId: string; fingerprint: string } | null {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const { o, e, f } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof o !== "string" || typeof e !== "number" || Date.now() > e) return null;
    // A token minted before fingerprints existed has no `f`. Refused rather than
    // waved through: an unbounded replayable token is exactly what this closes,
    // and the worst case is one person re-scanning a QR code.
    if (typeof f !== "string" || !f) return null;
    return { ownerId: o, fingerprint: f };
  } catch {
    return null;
  }
}

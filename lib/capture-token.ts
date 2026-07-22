import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { requiredEnv } from "@/lib/env";

/**
 * Short-lived, HMAC-signed token that authorises a phone to upload the
 * biometric selfie for a specific owner — without the phone being logged in.
 * The token IS the authorisation, so it expires quickly.
 */
const TTL_MS = 15 * 60 * 1000; // 15 minutes

function sign(data: string): string {
  return createHmac("sha256", requiredEnv("AUTH_SECRET")).update(data).digest("base64url");
}

export function createCaptureToken(ownerId: string): string {
  const payload = Buffer.from(JSON.stringify({ o: ownerId, e: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

/** Returns the ownerId if the token is valid and unexpired, else null. */
export function verifyCaptureToken(token: string): string | null {
  const [payload, sig] = String(token).split(".");
  if (!payload || !sig) return null;
  const expected = sign(payload);
  try {
    if (sig.length !== expected.length) return null;
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const { o, e } = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof o !== "string" || typeof e !== "number" || Date.now() > e) return null;
    return o;
  } catch {
    return null;
  }
}

import { NextResponse } from "next/server";

/**
 * Fixed-window, in-memory rate limiter. It is PER SERVERLESS INSTANCE, so on a
 * multi-instance host (Vercel) it is best-effort — a solid first line against
 * naive floods from a single source, not an authority. Limits that must not be
 * bypassable across instances (the OTP resend cooldown) are enforced in the DB
 * instead. Swap this for Redis/Upstash when a global limit is needed.
 */

type Window = { count: number; resetAt: number };

const buckets = new Map<string, Window>();
const MAX_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, w] of buckets) {
    if (w.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the window resets (0 when allowed). */
  retryAfterSec: number;
};

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();

  // Bound memory: when the map gets large, drop everything already expired.
  if (buckets.size > MAX_KEYS) sweep(now);

  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0 };
  }

  w.count += 1;
  if (w.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - w.count, retryAfterSec: 0 };
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

/** Best-effort client IP for keying limits; falls back to a shared bucket. */
export function ipKey(req: Request, scope: string): string {
  return `${scope}:${clientIp(req) ?? "unknown"}`;
}

/** Standard 429 with a Retry-After header. */
export function tooManyResponse(
  result: RateLimitResult,
  message = "Too many requests. Please slow down and try again shortly."
): NextResponse {
  return NextResponse.json(
    { error: message },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}

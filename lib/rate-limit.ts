import { NextResponse } from "next/server";

/**
 * Fixed-window rate limiting, with a shared counter when one is configured.
 *
 * TWO LAYERS, on purpose:
 *
 *   Upstash Redis  when UPSTASH_REDIS_REST_URL + _TOKEN are set. One counter for
 *                  the whole deployment, so a limit means what it says.
 *   in-memory Map  otherwise, and whenever Redis cannot be reached. PER SERVERLESS
 *                  INSTANCE, so an attacker spreading requests across warm
 *                  instances multiplies every limit and a cold start resets them.
 *                  A real first line against a naive flood; never an authority.
 *
 * WHY IT FALLS BACK RATHER THAN FAILING CLOSED
 *   If Redis is down and we refused every request, an outage at a third party
 *   would take donations and registrations offline. Denying service to everyone is
 *   a worse outcome than a temporarily weaker limit, so the in-memory counter takes
 *   over and the failure is logged. That is a deliberate trade, not an oversight.
 *
 * WHAT THIS IS NOT
 *   The limits that must not be bypassable do NOT live here. The OTP resend
 *   cooldown and the sign-in lockout are counted in the database, on the row they
 *   protect (lib/auth/otp.ts, lib/auth/lockout.ts). This layer is for volume.
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
  /** Which counter answered — useful in logs, and asserted in the tests. */
  backend: "redis" | "memory";
};

/** The in-memory fallback. Also the whole implementation when Redis is unset. */
function memoryLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  // Bound memory: when the map gets large, drop everything already expired.
  if (buckets.size > MAX_KEYS) sweep(now);

  const w = buckets.get(key);
  if (!w || w.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSec: 0, backend: "memory" };
  }

  w.count += 1;
  if (w.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((w.resetAt - now) / 1000)),
      backend: "memory",
    };
  }
  return {
    ok: true,
    remaining: limit - w.count,
    retryAfterSec: 0,
    backend: "memory",
  };
}

/**
 * Upstash over its REST API — deliberately no SDK.
 *
 * A dependency for three HTTP calls is not worth the supply-chain surface on a
 * project that handles identity documents and money, and plain fetch works on the
 * edge runtime, which is where the middleware limiter runs.
 *
 * One pipelined round trip:
 *   INCR       the counter, creating it at 1 if absent
 *   PEXPIRE NX the window, set only if the key has no TTL yet — so the window
 *              starts at the first request and does not slide forward with each
 *              one, which would let a steady trickle never reset
 *   PTTL       how long is left, for Retry-After
 */
async function redisLimit(
  key: string,
  limit: number,
  windowMs: number,
  url: string,
  token: string
): Promise<RateLimitResult | null> {
  // A slow Redis must not hold up a request. If it cannot answer quickly the
  // in-memory counter takes over.
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), 1000);
  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", key],
        ["PEXPIRE", key, String(windowMs), "NX"],
        ["PTTL", key],
      ]),
      cache: "no-store",
      signal: abort.signal,
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { result?: unknown; error?: string }[];
    if (!Array.isArray(body) || body.length < 3) return null;
    if (body.some((r) => r?.error)) return null;

    const count = Number(body[0]?.result);
    const pttl = Number(body[2]?.result);
    if (!Number.isFinite(count)) return null;

    // PTTL is -1 when the key somehow has no expiry. Falling back to the full
    // window is the safe reading: it cannot under-report the wait.
    const msLeft = Number.isFinite(pttl) && pttl > 0 ? pttl : windowMs;

    if (count > limit) {
      return {
        ok: false,
        remaining: 0,
        retryAfterSec: Math.max(1, Math.ceil(msLeft / 1000)),
        backend: "redis",
      };
    }
    return {
      ok: true,
      remaining: Math.max(0, limit - count),
      retryAfterSec: 0,
      backend: "redis",
    };
  } catch {
    return null; // timeout, DNS, TLS — the caller falls back
  } finally {
    clearTimeout(timer);
  }
}

/** True when a shared counter is configured. */
export function distributedRateLimitEnabled(): boolean {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );
}

/**
 * Count one request against `key`.
 *
 * Async because the shared counter is a network call. Every caller already sits in
 * an async handler, so this costs nothing structurally.
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url && token) {
    const viaRedis = await redisLimit(key, limit, windowMs, url, token);
    if (viaRedis) return viaRedis;
    // Reached only when Redis is configured but did not answer. Worth saying out
    // loud: the deployment is quietly running on per-instance limits.
    console.error(
      "[rate-limit] Upstash did not answer — falling back to the per-instance " +
        "counter, which an attacker can spread requests around."
    );
  }

  return memoryLimit(key, limit, windowMs);
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

/** Test-only: clear the in-memory buckets so cases cannot leak into each other. */
export function __resetMemoryBuckets(): void {
  buckets.clear();
}

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  rateLimit,
  ipKey,
  distributedRateLimitEnabled,
  __resetMemoryBuckets,
} from "@/lib/rate-limit";

/**
 * Rate limiting has two backends and the difference matters.
 *
 * With Upstash configured there is ONE counter for the deployment, so a limit
 * means what it says. Without it — or when Redis cannot be reached — the counter
 * is a per-instance Map, which an attacker can spread requests around and which a
 * cold start resets.
 *
 * The behaviour worth pinning is the fallback: if Redis is down, requests must
 * still be SERVED under the local limit, not refused. Failing closed would let a
 * third-party outage take donations and registrations offline, which is a worse
 * outcome than a temporarily weaker limit.
 */

const REDIS_ENV = ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"] as const;

function clearRedisEnv() {
  for (const k of REDIS_ENV) delete process.env[k];
}

describe("rateLimit — in-memory backend", () => {
  beforeEach(() => {
    clearRedisEnv();
    __resetMemoryBuckets();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("allows up to the limit, then blocks", async () => {
    const key = `k-${Math.random()}`;
    expect((await rateLimit(key, 3, 60_000)).ok).toBe(true); // 1
    expect((await rateLimit(key, 3, 60_000)).ok).toBe(true); // 2
    const third = await rateLimit(key, 3, 60_000); // 3
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = await rateLimit(key, 3, 60_000); // 4 → over
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
    expect(blocked.backend).toBe("memory");
  });

  it("resets after the window elapses", async () => {
    const key = `k-${Math.random()}`;
    await rateLimit(key, 1, 60_000); // uses the single allowance
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
  });

  it("tracks separate keys independently", async () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(a, 1, 60_000)).ok).toBe(false);
    // b is untouched by a's usage
    expect((await rateLimit(b, 1, 60_000)).ok).toBe(true);
  });

  it("reports that no shared counter is configured", () => {
    expect(distributedRateLimitEnabled()).toBe(false);
  });

  it("makes no network call when Upstash is unset", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    await rateLimit(`k-${Math.random()}`, 5, 60_000);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("rateLimit — shared counter (Upstash)", () => {
  beforeEach(() => {
    __resetMemoryBuckets();
    process.env.UPSTASH_REDIS_REST_URL = "https://fake-upstash.test";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";
  });
  afterEach(() => {
    clearRedisEnv();
    vi.unstubAllGlobals();
  });

  /** Upstash's pipeline shape: one {result} per command, in order. */
  const pipeline = (count: number, pttlMs: number) =>
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [{ result: count }, { result: 1 }, { result: pttlMs }],
    }) as unknown as Response);

  it("is reported as enabled", () => {
    expect(distributedRateLimitEnabled()).toBe(true);
  });

  it("allows while the shared count is within the limit", async () => {
    vi.stubGlobal("fetch", pipeline(2, 45_000));
    const res = await rateLimit("shared-key", 5, 60_000);
    expect(res.ok).toBe(true);
    expect(res.backend).toBe("redis");
    expect(res.remaining).toBe(3);
  });

  it("blocks once the shared count passes the limit, using the real TTL", async () => {
    vi.stubGlobal("fetch", pipeline(9, 30_000));
    const res = await rateLimit("shared-key", 5, 60_000);
    expect(res.ok).toBe(false);
    expect(res.backend).toBe("redis");
    expect(res.retryAfterSec).toBe(30); // from PTTL, not the nominal window
  });

  it("sends INCR, PEXPIRE NX and PTTL in one round trip", async () => {
    // PEXPIRE must be NX: without it the window slides forward on every request
    // and a steady trickle would never reset.
    let body: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_u: string, init?: RequestInit) => {
        body = JSON.parse(String(init?.body));
        return {
          ok: true,
          status: 200,
          json: async () => [{ result: 1 }, { result: 1 }, { result: 60_000 }],
        } as unknown as Response;
      })
    );
    await rateLimit("shared-key", 5, 60_000);
    expect(body).toEqual([
      ["INCR", "shared-key"],
      ["PEXPIRE", "shared-key", "60000", "NX"],
      ["PTTL", "shared-key"],
    ]);
  });

  it("FALLS BACK to the local counter when Redis errors, and still serves", async () => {
    // The trade this codifies: a Redis outage must not take donations offline.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }) as unknown as Response)
    );
    const res = await rateLimit(`fb-${Math.random()}`, 5, 60_000);
    expect(res.ok).toBe(true);
    expect(res.backend).toBe("memory");
  });

  it("falls back when Redis times out or the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("ETIMEDOUT");
    }));
    const res = await rateLimit(`fb-${Math.random()}`, 5, 60_000);
    expect(res.ok).toBe(true);
    expect(res.backend).toBe("memory");
  });

  it("falls back when the pipeline returns an error entry", async () => {
    // A malformed or partially-failed pipeline must not be read as "allowed" from
    // a count of NaN.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => [{ error: "WRONGTYPE" }, { result: 1 }, { result: 1000 }],
      }) as unknown as Response)
    );
    const res = await rateLimit(`fb-${Math.random()}`, 5, 60_000);
    expect(res.backend).toBe("memory");
  });

  it("still blocks on the local counter after falling back", async () => {
    // Falling back must not mean "no limit at all".
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("down");
    }));
    const key = `fb-hard-${Math.random()}`;
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(true);
    expect((await rateLimit(key, 1, 60_000)).ok).toBe(false);
  });
});

describe("ipKey", () => {
  const make = (headers: Record<string, string>) =>
    new Request("https://example.com", { headers });

  it("prefers the first x-forwarded-for hop", () => {
    const req = make({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" });
    expect(ipKey(req, "donate")).toBe("donate:203.0.113.7");
  });

  it("falls back to x-real-ip", () => {
    const req = make({ "x-real-ip": "198.51.100.2" });
    expect(ipKey(req, "otp")).toBe("otp:198.51.100.2");
  });

  it("uses an 'unknown' bucket when no IP header is present", () => {
    expect(ipKey(make({}), "register")).toBe("register:unknown");
  });
});

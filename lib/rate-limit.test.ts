import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { rateLimit, ipKey } from "@/lib/rate-limit";

describe("rateLimit (fixed window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T00:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows up to the limit, then blocks", () => {
    const key = `k-${Math.random()}`;
    expect(rateLimit(key, 3, 60_000).ok).toBe(true); // 1
    expect(rateLimit(key, 3, 60_000).ok).toBe(true); // 2
    const third = rateLimit(key, 3, 60_000); // 3
    expect(third.ok).toBe(true);
    expect(third.remaining).toBe(0);

    const blocked = rateLimit(key, 3, 60_000); // 4 → over
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("resets after the window elapses", () => {
    const key = `k-${Math.random()}`;
    rateLimit(key, 1, 60_000); // uses the single allowance
    expect(rateLimit(key, 1, 60_000).ok).toBe(false);

    vi.advanceTimersByTime(60_001);
    expect(rateLimit(key, 1, 60_000).ok).toBe(true);
  });

  it("tracks separate keys independently", () => {
    const a = `a-${Math.random()}`;
    const b = `b-${Math.random()}`;
    expect(rateLimit(a, 1, 60_000).ok).toBe(true);
    expect(rateLimit(a, 1, 60_000).ok).toBe(false);
    // b is untouched by a's usage
    expect(rateLimit(b, 1, 60_000).ok).toBe(true);
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

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  lockState,
  recordFailedLogin,
  clearFailedLogins,
  LOCKOUT_POLICY,
} from "@/lib/auth/lockout";
import { createOtp, verifyOtp, MAX_VERIFY_ATTEMPTS } from "@/lib/auth/otp";

/**
 * Brute-force defence on sign-in and on the admin second factor.
 *
 * Before this, /api/auth/callback/credentials accepted unlimited password
 * attempts — no counter, no lock, no delay — while every other public write path
 * in the app was rate-limited. And verifyOtp compared a 6-digit code without
 * counting wrong guesses, so an attacker holding an admin's password could grind
 * the second factor within its 10-minute life.
 *
 * Counted in the DATABASE on purpose: lib/rate-limit.ts is a per-instance Map, so
 * on Vercel an attacker spreading attempts across warm instances multiplies the
 * limit and a cold start resets it. A lock you can retry past is not a lock.
 *
 * Both directions are tested. A lockout is itself an attack surface — lock too
 * eagerly and you deny a fundraiser access to their own money — so the tests also
 * assert that a correct password clears the count and that old failures expire.
 */
const url = process.env.DATABASE_URL ?? "";
const isLocal =
  process.env.INTEGRATION_DB === "1" &&
  /@(127\.0\.0\.1|localhost)[:/]/.test(url) &&
  !/supabase/i.test(url);

const sfx = Math.random().toString(36).slice(2, 10);
const userId = `lo-user-${sfx}`;

const load = () =>
  db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      failedLoginAttempts: true,
      lastFailedLoginAt: true,
      lockedUntil: true,
    },
  });

describe.skipIf(!isLocal)("brute-force defences", () => {
  beforeAll(async () => {
    await db.user.create({
      data: {
        id: userId,
        name: "Lockout Test",
        email: `${userId}@test.local`,
        passwordHash: "x",
        role: "ADMIN",
      },
    });
  });

  beforeEach(async () => {
    await db.user.update({
      where: { id: userId },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
  });

  afterAll(async () => {
    if (!isLocal) return;
    await db.otpCode.deleteMany({ where: { userId } });
    await db.user.deleteMany({ where: { id: userId } });
    await db.$disconnect();
  });

  describe("sign-in lockout", () => {
  it("a clean account is not locked", async () => {
    expect(lockState(await load())).toEqual({ locked: false, retryAfterSec: 0 });
  });

  it("counts failures without locking below the threshold", async () => {
    for (let i = 0; i < LOCKOUT_POLICY.MAX_FAILURES - 1; i++) {
      await recordFailedLogin(await load());
    }
    const user = await load();
    expect(user.failedLoginAttempts).toBe(LOCKOUT_POLICY.MAX_FAILURES - 1);
    // Still usable — a person mistyping must not be locked out early.
    expect(lockState(user).locked).toBe(false);
  });

  it("LOCKS at the threshold, and reports how long to wait", async () => {
    for (let i = 0; i < LOCKOUT_POLICY.MAX_FAILURES; i++) {
      await recordFailedLogin(await load());
    }
    const state = lockState(await load());
    expect(state.locked).toBe(true);
    expect(state.retryAfterSec).toBeGreaterThan(0);
    expect(state.retryAfterSec).toBeLessThanOrEqual(LOCKOUT_POLICY.LOCK_MS / 1000);
  });

  it("a correct password clears the count, so a typo never accumulates", async () => {
    for (let i = 0; i < 5; i++) await recordFailedLogin(await load());
    expect((await load()).failedLoginAttempts).toBe(5);

    await clearFailedLogins(await load());
    const user = await load();
    expect(user.failedLoginAttempts).toBe(0);
    expect(user.lockedUntil).toBeNull();
    expect(lockState(user).locked).toBe(false);
  });

  it("forgets failures older than the window", async () => {
    // Eleven failures, then a long gap. Without expiry, one more mistake weeks
    // later would lock an innocent account.
    await db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: LOCKOUT_POLICY.MAX_FAILURES - 1,
        lastFailedLoginAt: new Date(
          Date.now() - LOCKOUT_POLICY.FAILURE_WINDOW_MS - 60_000
        ),
      },
    });
    await recordFailedLogin(await load());
    const user = await load();
    expect(user.failedLoginAttempts).toBe(1); // restarted, not incremented to 12
    expect(lockState(user).locked).toBe(false);
  });

  it("an expired lock lets them back in", async () => {
    await db.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    });
    expect(lockState(await load()).locked).toBe(false);
  });
  });

  describe("OTP attempt cap (admin second factor)", () => {
  it("accepts the right code", async () => {
    await db.otpCode.deleteMany({ where: { userId } });
    const created = await createOtp(userId, "LOGIN_2FA");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect((await verifyOtp(userId, "LOGIN_2FA", created.code)).ok).toBe(true);
  });

  it("BURNS the code after too many wrong guesses, so it cannot be ground", async () => {
    await db.otpCode.deleteMany({ where: { userId } });
    const created = await createOtp(userId, "LOGIN_2FA");
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    for (let i = 0; i < MAX_VERIFY_ATTEMPTS; i++) {
      expect((await verifyOtp(userId, "LOGIN_2FA", "000000")).ok).toBe(false);
    }

    // The cap is reached. Even the CORRECT code must now fail — otherwise an
    // attacker simply keeps going until they find it.
    const after = await verifyOtp(userId, "LOGIN_2FA", created.code);
    expect(after.ok).toBe(false);

    const row = await db.otpCode.findFirstOrThrow({
      where: { userId, purpose: "LOGIN_2FA" },
      orderBy: { createdAt: "desc" },
    });
    expect(row.usedAt).not.toBeNull(); // burned, not merely refused
  });

  it("a wrong guess does not burn a code that still has attempts left", async () => {
    // The other direction: an admin who fat-fingers one digit must still be able
    // to type it correctly.
    await db.otpCode.deleteMany({ where: { userId } });
    const created = await createOtp(userId, "LOGIN_2FA");
    if (!created.ok) return;

    expect((await verifyOtp(userId, "LOGIN_2FA", "999999")).ok).toBe(false);
    expect((await verifyOtp(userId, "LOGIN_2FA", created.code)).ok).toBe(true);
  });
  });
});

describe.skipIf(isLocal)("lockout integration tests", () => {
  it("skipped — needs INTEGRATION_DB=1 and a local database", () => {
    expect(isLocal).toBe(false);
  });
});

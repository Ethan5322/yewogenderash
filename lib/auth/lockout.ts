import "server-only";
import { db } from "@/lib/db";

/**
 * Sign-in brute-force defence, counted in the database.
 *
 * Every other public write endpoint in this app is rate-limited. The sign-in
 * endpoint was not: unlimited email+password attempts, no counter, no delay — and
 * behind those passwords sit KYC data, Chapa keys and payout approval.
 *
 * WHY NOT lib/rate-limit.ts
 *   That is a per-instance Map. On Vercel an attacker spreading attempts across
 *   warm instances multiplies the limit, and a cold start resets it. It is still
 *   used as a cheap first line in the middleware; this is the one that holds.
 *
 * THE DELIBERATE TRADE-OFF
 *   A lockout is itself an attack: guess a fundraiser's password a few times and
 *   you can lock them out of their own money. So the threshold is generous, the
 *   lock is SHORT, and it clears the moment a real sign-in succeeds. The goal is
 *   to make a million-guess campaign impossible, not to punish a typo.
 */

/** Wrong passwords tolerated before the account locks. Generous on purpose. */
const MAX_FAILURES = 12;

/** How long a lock lasts. Short on purpose — see above. */
const LOCK_MS = 15 * 60 * 1000;

/** Failures older than this are forgotten, so yesterday's typos never lock you. */
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

export type LockState = { locked: boolean; retryAfterSec: number };

/**
 * Is this account currently locked?
 *
 * Called with the user row already loaded, so the sign-in path costs no extra
 * query for the common case.
 */
export function lockState(user: {
  lockedUntil: Date | null;
}): LockState {
  const until = user.lockedUntil?.getTime() ?? 0;
  const now = Date.now();
  if (until > now) {
    return { locked: true, retryAfterSec: Math.ceil((until - now) / 1000) };
  }
  return { locked: false, retryAfterSec: 0 };
}

/**
 * Record a wrong password and lock the account if it has now had too many.
 *
 * Failures outside the window are treated as a fresh start rather than
 * accumulating forever — otherwise a user who mistypes twice a month eventually
 * locks themselves out for no reason.
 *
 * Never throws: a counter that fails must not break sign-in for everybody. It is
 * a defence, not a dependency.
 */
export async function recordFailedLogin(user: {
  id: string;
  failedLoginAttempts: number;
  lastFailedLoginAt: Date | null;
}): Promise<void> {
  try {
    const stale =
      !user.lastFailedLoginAt ||
      Date.now() - user.lastFailedLoginAt.getTime() > FAILURE_WINDOW_MS;
    const attempts = stale ? 1 : user.failedLoginAttempts + 1;

    await db.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: attempts,
        lastFailedLoginAt: new Date(),
        ...(attempts >= MAX_FAILURES
          ? { lockedUntil: new Date(Date.now() + LOCK_MS) }
          : {}),
      },
    });
  } catch (e) {
    console.error("[lockout] could not record a failed login", e);
  }
}

/**
 * Clear the counters after a genuine sign-in.
 *
 * Skipped when there is nothing to clear, so the overwhelmingly common case — a
 * correct password on a clean account — costs no write at all.
 */
export async function clearFailedLogins(user: {
  id: string;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
}): Promise<void> {
  if (user.failedLoginAttempts === 0 && !user.lockedUntil) return;
  try {
    await db.user.update({
      where: { id: user.id },
      data: { failedLoginAttempts: 0, lastFailedLoginAt: null, lockedUntil: null },
    });
  } catch (e) {
    console.error("[lockout] could not clear failed logins", e);
  }
}

/** Exposed for tests and for the lockout integration suite. */
export const LOCKOUT_POLICY = { MAX_FAILURES, LOCK_MS, FAILURE_WINDOW_MS } as const;

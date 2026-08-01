-- Yewogen Derash — additive migration 0024
-- Brute-force defence on sign-in and on the admin second factor.
--
-- WHY
--   Every public write endpoint in this app is rate-limited (register, donate,
--   otp/request, otp/verify, capture). The SIGN-IN endpoint was not. An attacker
--   could try unlimited email+password combinations against
--   /api/auth/callback/credentials with no lockout, no counter and no delay —
--   and behind those passwords sit KYC data, Chapa keys and payout approval.
--
--   The admin second factor had the same gap. verifyOtp compared the code and
--   returned, without counting wrong guesses: a 6-digit code is 1,000,000
--   possibilities, valid for 10 minutes, and was not invalidated by a wrong
--   answer. An attacker holding an admin's password could grind it.
--
-- WHY IN THE DATABASE AND NOT IN MEMORY
--   lib/rate-limit.ts is a per-instance Map — a solid first line, but on Vercel an
--   attacker spreading requests across warm instances multiplies every limit and a
--   cold start resets them. A lockout that can be bypassed by retrying is not a
--   lockout. These counters therefore live on the row they protect.
--
-- ON LOCK DURATION
--   The lock is short on purpose. A long lock turns a password-guessing attack
--   into a denial of service against a fundraiser who needs to reach their money,
--   which is a real harm traded for a small one. Counters clear on any successful
--   sign-in.
--
-- SAFE ON THE SHARED PROJECT: only yd_users and yd_otp_codes are touched, and
-- only by adding columns that default to "nothing has happened yet". No existing
-- value is read or changed, and no behaviour changes until the application code
-- that uses these columns is deployed.

ALTER TABLE "yd_users"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastFailedLoginAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

ALTER TABLE "yd_otp_codes"
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

-- ── The enum value that admin 2FA depends on ────────────────────────────────
-- LOGIN_2FA is declared on OtpPurpose in schema.prisma and is what auth.ts asks
-- for when an admin signs in — and it appears in NO migration. 0001 created the
-- type with only EMAIL_VERIFY, PHONE_VERIFY and PASSWORD_RESET.
--
-- The live database must have had it added by hand, because admin sign-in works
-- there. Any database rebuilt from this repo did not, and admin 2FA failed on it
-- with "invalid input value for enum yd_otp_purpose" — which is how this was
-- found: the lockout tests could not create a LOGIN_2FA code at all.
--
-- This is the third time schema.prisma and the migrations have disagreed
-- (isSuperAdmin/adminPermissions in 0019, currentAmount's meaning in 0023). The
-- parity checker missed this one because it compares tables and columns, not enum
-- values — now fixed in scripts/check-migration-parity.mjs.
--
-- IF NOT EXISTS makes this a no-op on the live database.
ALTER TYPE "yd_otp_purpose" ADD VALUE IF NOT EXISTS 'LOGIN_2FA';

-- ── Verification: both rows must say OK ─────────────────────────────────────
SELECT
  'login lockout columns' AS check,
  CASE WHEN (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'yd_users'
       AND column_name IN ('failedLoginAttempts', 'lastFailedLoginAt', 'lockedUntil')
  ) = 3 THEN 'OK' ELSE 'MISSING — sign-in brute force is unthrottled' END AS result
UNION ALL
SELECT
  'otp attempt counter',
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'yd_otp_codes' AND column_name = 'attempts'
  ) THEN 'OK' ELSE 'MISSING — 2FA codes can be guessed without limit' END
UNION ALL
SELECT
  'LOGIN_2FA enum value',
  CASE WHEN EXISTS (
    SELECT 1 FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
     WHERE t.typname = 'yd_otp_purpose' AND e.enumlabel = 'LOGIN_2FA'
  ) THEN 'OK' ELSE 'MISSING — admin 2FA cannot issue codes' END;

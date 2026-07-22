-- Editable platform policy (singleton) + per-subaccount fee rate.
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS yd_platform_settings (
  id                  text        PRIMARY KEY DEFAULT 'singleton',
  "feeRate"           double precision NOT NULL DEFAULT 0.03,
  "autoApproveMaxEtb" integer     NOT NULL DEFAULT 5000,
  "updatedById"       text,
  "updatedAt"         timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed the singleton row if absent.
INSERT INTO yd_platform_settings (id) VALUES ('singleton')
  ON CONFLICT (id) DO NOTHING;

-- Record the fee rate baked into each payout account's Chapa subaccount.
ALTER TABLE yd_payout_accounts
  ADD COLUMN IF NOT EXISTS "feeRate" double precision;

-- Backfill existing accounts with the historical flat 3% they were created at.
UPDATE yd_payout_accounts SET "feeRate" = 0.03 WHERE "feeRate" IS NULL;

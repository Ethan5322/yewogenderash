-- Editable minimum payout threshold. Idempotent.
ALTER TABLE yd_platform_settings
  ADD COLUMN IF NOT EXISTS "minPayoutEtb" integer NOT NULL DEFAULT 100;

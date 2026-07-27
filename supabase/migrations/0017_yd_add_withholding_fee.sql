-- Yewogen Derash — additive migration 0017
-- Safety & guarantee withholding on withdrawals (7% of a campaign's gross,
-- charged once and deducted from payouts; retained by the platform).
-- SAFE ON THE SHARED PROJECT: only the yd_payouts table is touched.

ALTER TABLE "yd_payouts"
  ADD COLUMN IF NOT EXISTS "withholdingFee" DECIMAL(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netPaidAmount" DECIMAL(12, 2);

-- Existing payouts predate the withholding, so they carry none: what was paid
-- out is exactly what was requested. Setting netPaidAmount explicitly keeps the
-- admin/owner views from having to special-case historical rows.
UPDATE "yd_payouts"
   SET "netPaidAmount" = "amount"
 WHERE "netPaidAmount" IS NULL;

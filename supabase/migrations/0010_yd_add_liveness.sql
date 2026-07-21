-- Yewogen Derash — additive migration 0010
-- Active-liveness result on the biometric capture (brief §7.1).
-- SAFE ON THE SHARED PROJECT: only the yd_campaign_owners table.

ALTER TABLE "yd_campaign_owners"
  ADD COLUMN IF NOT EXISTS "livenessPassed" BOOLEAN NOT NULL DEFAULT false;

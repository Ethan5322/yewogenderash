-- Yewogen Derash — additive migration 0009
-- Anti-fraud flags on campaigns and owners (brief §12.2 / §13).
-- SAFE ON THE SHARED PROJECT: only yd_campaigns and yd_campaign_owners.

ALTER TABLE "yd_campaigns"
  ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "flagReason" TEXT;

ALTER TABLE "yd_campaign_owners"
  ADD COLUMN IF NOT EXISTS "flagged" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "flagReason" TEXT;

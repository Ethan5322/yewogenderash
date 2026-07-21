-- Yewogen Derash — additive migration 0003
-- Adds the public ID-card portrait for the corporate Fundraiser ID.
-- SAFE ON THE SHARED PROJECT: touches only the yd_campaign_owners table.

ALTER TABLE "yd_campaign_owners"
  ADD COLUMN IF NOT EXISTS "idPhotoUrl" TEXT;

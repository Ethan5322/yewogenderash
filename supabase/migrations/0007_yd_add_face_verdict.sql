-- Yewogen Derash — additive migration 0007
-- Engine-agnostic biometric verdict (works for both the InsightFace service
-- and the in-browser face-api fallback).
-- SAFE ON THE SHARED PROJECT: only the yd_campaign_owners table.

ALTER TABLE "yd_campaign_owners"
  ADD COLUMN IF NOT EXISTS "faceMatched" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "faceEngine" TEXT;

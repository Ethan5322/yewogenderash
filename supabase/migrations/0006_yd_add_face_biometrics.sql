-- Yewogen Derash — additive migration 0006
-- Real biometric face recognition: enrolment descriptor + ID-photo match score.
-- SAFE ON THE SHARED PROJECT: only the yd_campaign_owners table.

ALTER TABLE "yd_campaign_owners"
  ADD COLUMN IF NOT EXISTS "faceDescriptor" JSONB,
  ADD COLUMN IF NOT EXISTS "idPhotoDescriptor" JSONB,
  ADD COLUMN IF NOT EXISTS "faceMatchScore" DOUBLE PRECISION;

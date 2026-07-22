-- Admin toggle to disable a campaign's querycode without changing the campaign.
ALTER TABLE yd_campaigns
  ADD COLUMN IF NOT EXISTS "queryCodeActive" boolean NOT NULL DEFAULT true;

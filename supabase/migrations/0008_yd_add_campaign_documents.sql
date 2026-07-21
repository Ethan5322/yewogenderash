-- Yewogen Derash — additive migration 0008
-- Per-campaign proof documents (category-matched evidence per campaign; §6.1/§6.2).
-- SAFE ON THE SHARED PROJECT: only the new yd_campaign_documents table.
-- Reuses existing enums yd_document_type / yd_document_status.

CREATE TABLE IF NOT EXISTS "yd_campaign_documents" (
  "id"           TEXT NOT NULL,
  "campaignId"   TEXT NOT NULL,
  "documentType" "yd_document_type" NOT NULL,
  "fileUrl"      TEXT NOT NULL,
  "status"       "yd_document_status" NOT NULL DEFAULT 'PENDING',
  "adminNote"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "yd_campaign_documents_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "yd_campaign_documents_campaignId_idx" ON "yd_campaign_documents"("campaignId");

DO $$ BEGIN
  ALTER TABLE "yd_campaign_documents" ADD CONSTRAINT "yd_campaign_documents_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

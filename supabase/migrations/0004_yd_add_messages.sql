-- Yewogen Derash — additive migration 0004
-- Fundraiser ↔ admin messaging + admin broadcast notices.
-- SAFE ON THE SHARED PROJECT: only the new yd_messages table.

CREATE TABLE IF NOT EXISTS "yd_messages" (
  "id"           TEXT NOT NULL,
  "ownerId"      TEXT,
  "senderUserId" TEXT,
  "fromAdmin"    BOOLEAN NOT NULL DEFAULT false,
  "isBroadcast"  BOOLEAN NOT NULL DEFAULT false,
  "subject"      TEXT,
  "body"         TEXT NOT NULL,
  "readByOwner"  BOOLEAN NOT NULL DEFAULT false,
  "readByAdmin"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "yd_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "yd_messages_ownerId_createdAt_idx" ON "yd_messages"("ownerId", "createdAt");
CREATE INDEX IF NOT EXISTS "yd_messages_isBroadcast_createdAt_idx" ON "yd_messages"("isBroadcast", "createdAt");

DO $$ BEGIN
  ALTER TABLE "yd_messages" ADD CONSTRAINT "yd_messages_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

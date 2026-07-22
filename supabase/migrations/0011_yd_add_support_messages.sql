-- Yewogen Derash — additive migration 0011
-- Public contact messages + abuse reports (Support inbox).
-- SAFE ON THE SHARED PROJECT: only the new yd_support_messages table.

CREATE TABLE IF NOT EXISTS "yd_support_messages" (
  "id"        TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'CONTACT',
  "name"      TEXT NOT NULL,
  "email"     TEXT NOT NULL,
  "code"      TEXT,
  "reason"    TEXT,
  "message"   TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'OPEN',
  "adminNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "yd_support_messages_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "yd_support_messages_type_status_createdAt_idx"
  ON "yd_support_messages"("type", "status", "createdAt");

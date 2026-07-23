-- Support case handoff: assign a case to an admin. Idempotent.
ALTER TABLE yd_support_messages
  ADD COLUMN IF NOT EXISTS "assignedToId" text,
  ADD COLUMN IF NOT EXISTS "assignedAt" timestamp(3);

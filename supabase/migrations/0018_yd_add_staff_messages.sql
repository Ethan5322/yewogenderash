-- Yewogen Derash — additive migration 0018
-- Internal staff line: private one-to-one messages between admins.
--
-- Separate from yd_messages on purpose. That table is the FUNDRAISER line (it
-- hangs off yd_campaign_owners and is gated behind the `messages` capability).
-- This one is staff-to-staff and open to every admin regardless of capability,
-- so a sub-admin holding only `kyc` can still reply to the main admin. Two
-- tables is what keeps one line's permissions and read state out of the other.
--
-- SAFE ON THE SHARED PROJECT: creates one new yd_-prefixed table and touches
-- nothing that already exists.

CREATE TABLE IF NOT EXISTS "yd_staff_messages" (
  "id"          TEXT PRIMARY KEY,
  "senderId"    TEXT NOT NULL REFERENCES "yd_users"("id") ON DELETE CASCADE,
  "recipientId" TEXT NOT NULL REFERENCES "yd_users"("id") ON DELETE CASCADE,
  "body"        TEXT NOT NULL,
  -- Null until the recipient opens the thread. Read state belongs to the
  -- recipient alone; a sender's own message is never unread to them.
  "readAt"      TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Unread badge: "messages addressed to me that I have not read yet".
CREATE INDEX IF NOT EXISTS "yd_staff_messages_recipient_read_idx"
  ON "yd_staff_messages" ("recipientId", "readAt");

-- Thread fetch: every message between one pair of admins, in order. The thread
-- query asks for both directions, so this is hit once per direction.
CREATE INDEX IF NOT EXISTS "yd_staff_messages_pair_idx"
  ON "yd_staff_messages" ("senderId", "recipientId", "createdAt");

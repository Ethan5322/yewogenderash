-- ═══════════════════════════════════════════════════════════════════════════
--  Yewogen Derash — PASTE THIS WHOLE FILE INTO THE SUPABASE SQL EDITOR
--  Migrations 0018 + 0019, in order. Run once, top to bottom.
--
--  HOW:  Supabase dashboard → SQL Editor → New query → paste all of this → Run.
--
--  SAFE TO RUN:
--    • Only creates ONE new table (yd_staff_messages) and adds TWO columns to
--      yd_users. Nothing existing is altered, renamed or dropped.
--    • Touches only yd_-prefixed objects. No other project on this Supabase
--      instance is affected.
--    • Every statement is IF NOT EXISTS, so running it twice does nothing the
--      second time. If you are unsure whether you already ran it — just run it.
--    • No data is written, changed or deleted.
--
--  WHAT YOU SHOULD SEE: "Success. No rows returned." That is correct — these
--  statements create structure, they do not select anything.
--
--  AFTER RUNNING: the last query in this file prints a verification table.
--  Both rows should say OK.
-- ═══════════════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────────────────────
--  0018 — Internal staff line: private messages between admins.
--
--  Separate from yd_messages on purpose. That table is the FUNDRAISER line (it
--  hangs off yd_campaign_owners and is gated behind the `messages` capability).
--  This one is staff-to-staff and open to every admin regardless of capability,
--  so a sub-admin holding only `kyc` can still reply to the main admin.
--
--  Without this table, /admin/team-chat will error.
-- ───────────────────────────────────────────────────────────────────────────

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

-- Thread fetch: every message between one pair of admins, in order.
CREATE INDEX IF NOT EXISTS "yd_staff_messages_pair_idx"
  ON "yd_staff_messages" ("senderId", "recipientId", "createdAt");


-- ───────────────────────────────────────────────────────────────────────────
--  0019 — The two delegated-admin columns that no migration ever created.
--
--  isSuperAdmin and adminPermissions are read on EVERY admin request, but they
--  were only ever added to the live database by hand — they appear in no
--  migration file. Your live database almost certainly already has them, in
--  which case the statement below changes nothing and that is the expected
--  outcome. It exists so that a database rebuilt from these files is correct.
--
--  Defaults are "no privileges", so nobody gains access by running this.
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE "yd_users"
  ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adminPermissions" JSONB NOT NULL DEFAULT '{}';


-- ═══════════════════════════════════════════════════════════════════════════
--  VERIFICATION — this last query prints a small table. Both rows must be OK.
-- ═══════════════════════════════════════════════════════════════════════════

SELECT
  'yd_staff_messages table' AS check,
  CASE WHEN EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_name = 'yd_staff_messages'
  ) THEN 'OK' ELSE 'MISSING — team chat will not work' END AS result
UNION ALL
SELECT
  'admin permission columns',
  CASE WHEN (
    SELECT COUNT(*) FROM information_schema.columns
     WHERE table_name = 'yd_users'
       AND column_name IN ('isSuperAdmin', 'adminPermissions')
  ) = 2 THEN 'OK' ELSE 'MISSING — admin pages will fail' END;

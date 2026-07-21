-- Yewogen Derash — additive migration 0005
-- Staff identifier (adminCode) for admins/sub-admins.
-- SAFE ON THE SHARED PROJECT: only the yd_users table.

ALTER TABLE "yd_users" ADD COLUMN IF NOT EXISTS "adminCode" TEXT;

-- Backfill existing admins with a unique code (hex from a random seed).
UPDATE "yd_users"
   SET "adminCode" = 'YWD-ADM-' || upper(substr(md5(random()::text || id), 1, 4))
 WHERE role = 'ADMIN' AND "adminCode" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "yd_users_adminCode_key" ON "yd_users"("adminCode");

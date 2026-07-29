-- Yewogen Derash — additive migration 0019
-- Backfills the two delegated-administration columns that the code has always
-- required but no migration ever created.
--
-- isSuperAdmin and adminPermissions are declared on the Prisma User model and
-- read on every single admin request (lib/admin/permissions.ts — currentAdmin,
-- hasPermission, requireSuperAdmin), yet neither appears anywhere in
-- migrations 0001-0018. The live database has them because they were added by
-- hand; the migration history does not, so any database rebuilt from these
-- files came up without them and every admin page failed on P2022
-- "column isSuperAdmin does not exist". That is how this was found: the
-- throwaway dev database could not create an admin user.
--
-- IF NOT EXISTS makes this a no-op against the live database, which already has
-- both columns, while making a fresh build correct.
--
-- SAFE ON THE SHARED PROJECT: only yd_users is touched, and only by adding
-- columns that default to "no privileges".

ALTER TABLE "yd_users"
  ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "adminPermissions" JSONB NOT NULL DEFAULT '{}';

-- Deliberately no data change. Defaulting to false/{} means a rebuilt database
-- has NO main admin until one is granted explicitly — safer than guessing which
-- account should hold every capability, which is a decision no migration should
-- make on its own.

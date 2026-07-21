-- Yewogen Derash — additive migration 0002
-- Adds: Chapa split-fee tracking on donations, per-donation fee ledger,
-- per-campaign balance summary, first-class payout accounts (Chapa
-- subaccounts), withdrawal auto-approval fields, and the public blog.
--
-- SAFE ON THE SHARED SUPABASE PROJECT: touches only yd_-prefixed objects.
-- Purely additive — no drops, no changes to existing column types.

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "yd_blog_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable: donation fee split
ALTER TABLE "yd_donations"
  ADD COLUMN IF NOT EXISTS "platformFee" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "netAmount"   DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "feeRate"     DECIMAL(5,4)  NOT NULL DEFAULT 0.03;

-- Backfill: existing SUCCESS donations predate the fee, so their net equals
-- gross and fee is zero (funds were credited in full historically).
UPDATE "yd_donations"
   SET "netAmount" = "amount", "platformFee" = 0, "feeRate" = 0
 WHERE "status" = 'SUCCESS' AND "netAmount" = 0;

-- AlterTable: withdrawal auto-approval + linked payout account
ALTER TABLE "yd_payouts"
  ADD COLUMN IF NOT EXISTS "autoApproved"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "reviewReason"     TEXT,
  ADD COLUMN IF NOT EXISTS "payoutAccountId"  TEXT;

-- CreateTable: yd_fee_ledger
CREATE TABLE IF NOT EXISTS "yd_fee_ledger" (
  "id"                TEXT NOT NULL,
  "donationId"        TEXT NOT NULL,
  "campaignId"        TEXT NOT NULL,
  "grossAmount"       DECIMAL(12,2) NOT NULL,
  "feeAmount"         DECIMAL(12,2) NOT NULL,
  "netAmount"         DECIMAL(12,2) NOT NULL,
  "feeRate"           DECIMAL(5,4) NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'ETB',
  "chapaSubaccountId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "yd_fee_ledger_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "yd_fee_ledger_donationId_key" ON "yd_fee_ledger"("donationId");
CREATE INDEX IF NOT EXISTS "yd_fee_ledger_campaignId_idx" ON "yd_fee_ledger"("campaignId");

-- CreateTable: yd_campaign_balances
CREATE TABLE IF NOT EXISTS "yd_campaign_balances" (
  "id"              TEXT NOT NULL,
  "campaignId"      TEXT NOT NULL,
  "grossRaised"     DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalFees"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "netRaised"       DECIMAL(12,2) NOT NULL DEFAULT 0,
  "totalWithdrawn"  DECIMAL(12,2) NOT NULL DEFAULT 0,
  "availableAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency"        TEXT NOT NULL DEFAULT 'ETB',
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "yd_campaign_balances_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "yd_campaign_balances_campaignId_key" ON "yd_campaign_balances"("campaignId");

-- CreateTable: yd_payout_accounts
CREATE TABLE IF NOT EXISTS "yd_payout_accounts" (
  "id"                TEXT NOT NULL,
  "ownerId"           TEXT NOT NULL,
  "accountName"       TEXT NOT NULL,
  "bankName"          TEXT NOT NULL,
  "bankCode"          TEXT NOT NULL,
  "accountNumber"     TEXT NOT NULL,
  "chapaSubaccountId" TEXT,
  "isVerified"        BOOLEAN NOT NULL DEFAULT false,
  "verifiedAt"        TIMESTAMP(3),
  "isDefault"         BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL,
  CONSTRAINT "yd_payout_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "yd_payout_accounts_ownerId_idx" ON "yd_payout_accounts"("ownerId");

-- CreateTable: yd_blog_posts
CREATE TABLE IF NOT EXISTS "yd_blog_posts" (
  "id"            TEXT NOT NULL,
  "slug"          TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "excerpt"       TEXT NOT NULL,
  "body"          TEXT NOT NULL,
  "coverImageUrl" TEXT,
  "status"        "yd_blog_status" NOT NULL DEFAULT 'DRAFT',
  "authorId"      TEXT,
  "publishedAt"   TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL,
  CONSTRAINT "yd_blog_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "yd_blog_posts_slug_key" ON "yd_blog_posts"("slug");
CREATE INDEX IF NOT EXISTS "yd_blog_posts_status_publishedAt_idx" ON "yd_blog_posts"("status", "publishedAt");

-- AddForeignKey (guarded — re-runnable)
DO $$ BEGIN
  ALTER TABLE "yd_fee_ledger" ADD CONSTRAINT "yd_fee_ledger_donationId_fkey"
    FOREIGN KEY ("donationId") REFERENCES "yd_donations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "yd_fee_ledger" ADD CONSTRAINT "yd_fee_ledger_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "yd_campaign_balances" ADD CONSTRAINT "yd_campaign_balances_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "yd_payout_accounts" ADD CONSTRAINT "yd_payout_accounts_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "yd_payouts" ADD CONSTRAINT "yd_payouts_payoutAccountId_fkey"
    FOREIGN KEY ("payoutAccountId") REFERENCES "yd_payout_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "yd_blog_posts" ADD CONSTRAINT "yd_blog_posts_authorId_fkey"
    FOREIGN KEY ("authorId") REFERENCES "yd_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

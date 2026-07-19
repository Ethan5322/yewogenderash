-- ═══════════════════════════════════════════════════════════════
-- Yewogen Derash — initial schema (0001_yd_create_core)
--
-- SHARED Supabase project: every object is yd_-prefixed and created in
-- the default public schema. This migration NEVER touches or drops any
-- non-yd_ object belonging to other apps in this database.
-- Generated from prisma/schema.prisma via prisma migrate diff.
-- ═══════════════════════════════════════════════════════════════


-- CreateEnum
CREATE TYPE "yd_role" AS ENUM ('DONOR', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "yd_verification_status" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "yd_biometric_status" AS ENUM ('NOT_CAPTURED', 'PENDING', 'VERIFIED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "yd_campaign_status" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "yd_campaign_category" AS ENUM ('MEDICAL', 'EDUCATION', 'COMMUNITY', 'BUSINESS', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "yd_donation_status" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "yd_payout_status" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "yd_document_type" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'SELFIE', 'PROOF_OF_ADDRESS', 'MEDICAL_LETTER', 'EDUCATION_LETTER', 'COMMUNITY_LETTER', 'BUSINESS_REGISTRATION', 'OTHER_SUPPORTING');

-- CreateEnum
CREATE TYPE "yd_document_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "yd_notification_channel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "yd_notification_status" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "yd_otp_purpose" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "yd_users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" "yd_role" NOT NULL DEFAULT 'DONOR',
    "verificationStatus" "yd_verification_status" NOT NULL DEFAULT 'UNVERIFIED',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_otp_codes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "yd_otp_purpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yd_otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_campaign_owners" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idNumber" TEXT,
    "biometricStatus" "yd_biometric_status" NOT NULL DEFAULT 'NOT_CAPTURED',
    "authorCode" TEXT,
    "mulesooVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "payoutAccount" JSONB,
    "whatsappAlerts" BOOLEAN NOT NULL DEFAULT true,
    "whatsappPhone" TEXT,
    "callmebotApiKey" TEXT,
    "termsAcceptedAt" TIMESTAMP(3),
    "feesAcceptedAt" TIMESTAMP(3),
    "biometricConsentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_campaign_owners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_verification_documents" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentType" "yd_document_type" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "yd_document_status" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_campaigns" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "story" TEXT,
    "category" "yd_campaign_category" NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "currentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "yd_campaign_status" NOT NULL DEFAULT 'DRAFT',
    "queryCode" TEXT NOT NULL,
    "qrCodeUrl" TEXT,
    "heroImageUrl" TEXT,
    "location" TEXT,
    "endDate" TIMESTAMP(3),
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_campaign_updates" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yd_campaign_updates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_donations" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "donorName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "paymentMethod" TEXT,
    "txRef" TEXT NOT NULL,
    "gatewayTransactionId" TEXT,
    "status" "yd_donation_status" NOT NULL DEFAULT 'PENDING',
    "webhookPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_payouts" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "yd_payout_status" NOT NULL DEFAULT 'REQUESTED',
    "payoutReference" TEXT,
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'chapa',
    "externalRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureOk" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yd_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_notifications" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "campaignId" TEXT,
    "channel" "yd_notification_channel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "yd_notification_status" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yd_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "yd_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "yd_site_content" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "yd_site_content_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "yd_users_email_key" ON "yd_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "yd_users_phone_key" ON "yd_users"("phone");

-- CreateIndex
CREATE INDEX "yd_otp_codes_userId_purpose_idx" ON "yd_otp_codes"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "yd_campaign_owners_userId_key" ON "yd_campaign_owners"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "yd_campaign_owners_authorCode_key" ON "yd_campaign_owners"("authorCode");

-- CreateIndex
CREATE INDEX "yd_verification_documents_ownerId_status_idx" ON "yd_verification_documents"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "yd_campaigns_slug_key" ON "yd_campaigns"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "yd_campaigns_queryCode_key" ON "yd_campaigns"("queryCode");

-- CreateIndex
CREATE INDEX "yd_campaigns_status_category_idx" ON "yd_campaigns"("status", "category");

-- CreateIndex
CREATE INDEX "yd_campaigns_ownerId_idx" ON "yd_campaigns"("ownerId");

-- CreateIndex
CREATE INDEX "yd_campaign_updates_campaignId_idx" ON "yd_campaign_updates"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "yd_donations_txRef_key" ON "yd_donations"("txRef");

-- CreateIndex
CREATE INDEX "yd_donations_campaignId_status_idx" ON "yd_donations"("campaignId", "status");

-- CreateIndex
CREATE INDEX "yd_donations_donorId_idx" ON "yd_donations"("donorId");

-- CreateIndex
CREATE INDEX "yd_payouts_campaignId_idx" ON "yd_payouts"("campaignId");

-- CreateIndex
CREATE INDEX "yd_payouts_ownerId_status_idx" ON "yd_payouts"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "yd_webhook_events_externalRef_key" ON "yd_webhook_events"("externalRef");

-- CreateIndex
CREATE INDEX "yd_notifications_ownerId_idx" ON "yd_notifications"("ownerId");

-- CreateIndex
CREATE INDEX "yd_notifications_campaignId_idx" ON "yd_notifications"("campaignId");

-- CreateIndex
CREATE INDEX "yd_audit_logs_actorId_idx" ON "yd_audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "yd_audit_logs_entityType_entityId_idx" ON "yd_audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "yd_site_content_key_key" ON "yd_site_content"("key");

-- AddForeignKey
ALTER TABLE "yd_otp_codes" ADD CONSTRAINT "yd_otp_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "yd_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_campaign_owners" ADD CONSTRAINT "yd_campaign_owners_userId_fkey" FOREIGN KEY ("userId") REFERENCES "yd_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_verification_documents" ADD CONSTRAINT "yd_verification_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_campaigns" ADD CONSTRAINT "yd_campaigns_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_campaign_updates" ADD CONSTRAINT "yd_campaign_updates_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_donations" ADD CONSTRAINT "yd_donations_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_donations" ADD CONSTRAINT "yd_donations_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "yd_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_payouts" ADD CONSTRAINT "yd_payouts_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_payouts" ADD CONSTRAINT "yd_payouts_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_notifications" ADD CONSTRAINT "yd_notifications_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "yd_campaign_owners"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_notifications" ADD CONSTRAINT "yd_notifications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "yd_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "yd_audit_logs" ADD CONSTRAINT "yd_audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "yd_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


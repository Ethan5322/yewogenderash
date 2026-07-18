-- ═══════════════════════════════════════════════════════════════
-- Yewogen Derash — initial database setup (0001_init.sql)
-- Paste this WHOLE file into the Supabase SQL editor and Run.
--
-- Everything is created inside the dedicated "yewogen" schema —
-- it never touches "public" or any other project in this shared
-- Supabase. Generated from prisma/schema.prisma (Prisma 7.8.0)
-- via: prisma migrate diff --from-empty --to-schema --script
-- ═══════════════════════════════════════════════════════════════

CREATE SCHEMA IF NOT EXISTS "yewogen";
SET search_path TO "yewogen";
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('DONOR', 'OWNER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VerificationStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "BiometricStatus" AS ENUM ('NOT_CAPTURED', 'PENDING', 'VERIFIED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'ARCHIVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CampaignCategory" AS ENUM ('MEDICAL', 'EDUCATION', 'COMMUNITY', 'BUSINESS', 'EMERGENCY', 'OTHER');

-- CreateEnum
CREATE TYPE "DonationStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NATIONAL_ID', 'PASSPORT', 'SELFIE', 'PROOF_OF_ADDRESS', 'MEDICAL_LETTER', 'EDUCATION_LETTER', 'COMMUNITY_LETTER', 'BUSINESS_REGISTRATION', 'OTHER_SUPPORTING');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RESUBMIT');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('WHATSAPP', 'EMAIL', 'SMS');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFY', 'PHONE_VERIFY', 'PASSWORD_RESET');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phone" TEXT,
    "phoneVerifiedAt" TIMESTAMP(3),
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DONOR',
    "verificationStatus" "VerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "isBanned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignOwner" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "idNumber" TEXT,
    "biometricStatus" "BiometricStatus" NOT NULL DEFAULT 'NOT_CAPTURED',
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

    CONSTRAINT "CampaignOwner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationDocument" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VerificationDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "story" TEXT,
    "category" "CampaignCategory" NOT NULL,
    "targetAmount" DECIMAL(12,2) NOT NULL,
    "currentAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
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

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignUpdate" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Donation" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "donorName" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "paymentMethod" TEXT,
    "txRef" TEXT NOT NULL,
    "gatewayTransactionId" TEXT,
    "status" "DonationStatus" NOT NULL DEFAULT 'PENDING',
    "webhookPayload" JSONB,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Donation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ETB',
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutReference" TEXT,
    "approvedByAdminId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'chapa',
    "externalRef" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureOk" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "campaignId" TEXT,
    "channel" "NotificationChannel" NOT NULL,
    "message" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "detail" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteContent" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "OtpCode_userId_purpose_idx" ON "OtpCode"("userId", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignOwner_userId_key" ON "CampaignOwner"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignOwner_authorCode_key" ON "CampaignOwner"("authorCode");

-- CreateIndex
CREATE INDEX "VerificationDocument_ownerId_status_idx" ON "VerificationDocument"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_queryCode_key" ON "Campaign"("queryCode");

-- CreateIndex
CREATE INDEX "Campaign_status_category_idx" ON "Campaign"("status", "category");

-- CreateIndex
CREATE INDEX "Campaign_ownerId_idx" ON "Campaign"("ownerId");

-- CreateIndex
CREATE INDEX "CampaignUpdate_campaignId_idx" ON "CampaignUpdate"("campaignId");

-- CreateIndex
CREATE UNIQUE INDEX "Donation_txRef_key" ON "Donation"("txRef");

-- CreateIndex
CREATE INDEX "Donation_campaignId_status_idx" ON "Donation"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Payout_campaignId_idx" ON "Payout"("campaignId");

-- CreateIndex
CREATE INDEX "Payout_ownerId_status_idx" ON "Payout"("ownerId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_externalRef_key" ON "WebhookEvent"("externalRef");

-- CreateIndex
CREATE INDEX "Notification_ownerId_idx" ON "Notification"("ownerId");

-- CreateIndex
CREATE INDEX "Notification_campaignId_idx" ON "Notification"("campaignId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "SiteContent_key_key" ON "SiteContent"("key");

-- AddForeignKey
ALTER TABLE "OtpCode" ADD CONSTRAINT "OtpCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignOwner" ADD CONSTRAINT "CampaignOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VerificationDocument" ADD CONSTRAINT "VerificationDocument_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CampaignOwner"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CampaignOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignUpdate" ADD CONSTRAINT "CampaignUpdate_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CampaignOwner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "CampaignOwner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


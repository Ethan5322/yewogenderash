import { createHash, randomInt } from "crypto";
import type { OtpPurpose } from "@prisma/client";
import { db } from "@/lib/db";

const OTP_TTL_MS = 10 * 60 * 1000; // 10 minutes
export const RESEND_COOLDOWN_SECONDS = 30;
const RESEND_COOLDOWN_MS = RESEND_COOLDOWN_SECONDS * 1000; // 30s between requests

function hashCode(code: string) {
  return createHash("sha256").update(code).digest("hex");
}

/**
 * Create a 6-digit OTP for a user+purpose. Invalidates previous unused codes.
 * Returns the plain code for DELIVERY ONLY (send via email/SMS — never in an
 * API response). DB-backed cooldown works across serverless instances.
 */
export async function createOtp(userId: string, purpose: OtpPurpose) {
  const recent = await db.otpCode.findFirst({
    where: {
      userId,
      purpose,
      createdAt: { gt: new Date(Date.now() - RESEND_COOLDOWN_MS) },
    },
  });
  if (recent) {
    return { ok: false as const, error: "COOLDOWN" as const };
  }

  await db.otpCode.deleteMany({ where: { userId, purpose, usedAt: null } });

  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  await db.otpCode.create({
    data: {
      userId,
      purpose,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  return { ok: true as const, code };
}

/** Verify an OTP: single-use, unexpired, constant-shape result. */
export async function verifyOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string
) {
  const record = await db.otpCode.findFirst({
    where: {
      userId,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.codeHash !== hashCode(code.trim())) {
    return { ok: false as const };
  }

  await db.otpCode.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const verifiedAt = new Date();
  if (purpose === "EMAIL_VERIFY") {
    await db.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: verifiedAt },
    });
  } else if (purpose === "PHONE_VERIFY") {
    await db.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: verifiedAt },
    });
  }

  return { ok: true as const };
}

/**
 * Delivery stub — Phase 2 scaffold. Real channels (email provider / SMS)
 * plug in here without touching callers. Codes are only ever printed to the
 * SERVER console, never returned to clients.
 */
export async function deliverOtp(params: {
  purpose: OtpPurpose;
  email?: string | null;
  phone?: string | null;
  code: string;
}) {
  console.log(
    `[otp] ${params.purpose} code for ${params.email ?? params.phone}: ${params.code}`
  );
}

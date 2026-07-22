import { createHash, randomInt } from "crypto";
import type { OtpPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { sendEmail, emailConfigured } from "@/lib/email";

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
 * Deliver an OTP by EMAIL. SMS is intentionally not used — the phone number is
 * collected for the admin to CALL during evaluation, and every verification
 * code (including the phone-verify purpose) is emailed to the account's email.
 * Falls back to the server console (dev) when email isn't configured.
 */
export async function deliverOtp(params: {
  purpose: OtpPurpose;
  email?: string | null;
  phone?: string | null;
  code: string;
}): Promise<{ emailConfigured: boolean; emailSent: boolean; error?: string }> {
  console.log(
    `[otp] ${params.purpose} code for ${params.email ?? params.phone}: ${params.code}`
  );

  if (!params.email || !emailConfigured()) {
    return { emailConfigured: emailConfigured(), emailSent: false };
  }

  const res = await sendEmail({
    to: params.email,
    subject: `Your Yewogen Derash verification code: ${params.code}`,
    text: `Your verification code is ${params.code}. It expires in 10 minutes.\n\nIf you did not request this, you can ignore this email.`,
    html:
      `<div style="font-family:system-ui,Arial,sans-serif">` +
      `<p>Your Yewogen Derash verification code is:</p>` +
      `<p style="font-size:28px;font-weight:700;letter-spacing:4px">${params.code}</p>` +
      `<p style="color:#555">It expires in 10 minutes. If you didn't request this, ignore this email.</p>` +
      `</div>`,
  });
  if (!res.ok) console.error("[otp] email delivery failed:", res.error);
  return { emailConfigured: true, emailSent: res.ok, error: res.ok ? undefined : res.error };
}

import "server-only";
import { createHash, randomBytes } from "crypto";
import { db } from "@/lib/db";
import { sendEmail, emailConfigured } from "@/lib/email";

/**
 * Password recovery by emailed link.
 *
 * Reuses the OtpCode table (purpose PASSWORD_RESET, already in the enum) rather
 * than adding a model: a reset token is just a long, single-use, expiring code.
 * Only the SHA-256 of the token is stored, so a database leak cannot be replayed
 * to seize accounts.
 *
 * The link is deliberately longer-lived than a 6-digit OTP (an hour, not ten
 * minutes) because people read email on a different device and come back to it.
 */

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REQUEST_COOLDOWN_MS = 60 * 1000; // one email per account per minute

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Issue a reset token, invalidating any previous unused one. Returns the plain
 * token for DELIVERY ONLY — it must never appear in a server response, only in
 * the emailed link.
 */
export async function createPasswordResetToken(
  userId: string
): Promise<{ ok: true; token: string } | { ok: false; error: "COOLDOWN" }> {
  const recent = await db.otpCode.findFirst({
    where: {
      userId,
      purpose: "PASSWORD_RESET",
      createdAt: { gt: new Date(Date.now() - REQUEST_COOLDOWN_MS) },
    },
    select: { id: true },
  });
  if (recent) return { ok: false, error: "COOLDOWN" };

  await db.otpCode.deleteMany({
    where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
  });

  // 32 random bytes — far beyond guessing, and unguessable without the email.
  const token = randomBytes(32).toString("base64url");
  await db.otpCode.create({
    data: {
      userId,
      purpose: "PASSWORD_RESET",
      codeHash: hashToken(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  return { ok: true, token };
}

/**
 * Resolve a token WITHOUT consuming it, so merely opening the link does not
 * burn it (people open, get distracted, and come back). It is marked used only
 * once the new password is actually saved.
 */
export async function findValidResetToken(token: string) {
  if (!token) return null;
  return db.otpCode.findFirst({
    where: {
      purpose: "PASSWORD_RESET",
      codeHash: hashToken(token),
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { id: true, userId: true },
  });
}

/** Mark the token spent and drop any other outstanding tokens for that user. */
export async function consumeResetToken(tokenId: string, userId: string) {
  await db.otpCode.update({
    where: { id: tokenId },
    data: { usedAt: new Date() },
  });
  await db.otpCode.deleteMany({
    where: { userId, purpose: "PASSWORD_RESET", usedAt: null },
  });
}

/** Email the reset link. Falls back to the server console when email is off. */
export async function sendPasswordResetEmail(params: {
  to: string;
  name: string;
  link: string;
}): Promise<{ sent: boolean; error?: string }> {
  console.log(`[password-reset] link for ${params.to}: ${params.link}`);
  if (!emailConfigured()) return { sent: false };

  const res = await sendEmail({
    to: params.to,
    subject: "Reset your Yewogen Derash password",
    text:
      `Hi ${params.name},\n\n` +
      `Use this link to choose a new password:\n${params.link}\n\n` +
      `The link expires in 1 hour and can be used once.\n\n` +
      `If you did not ask to reset your password, ignore this email — your ` +
      `current password still works.`,
    html:
      `<div style="font-family:system-ui,Arial,sans-serif;max-width:520px">` +
      `<p>Hi ${params.name},</p>` +
      `<p>Use the button below to choose a new password.</p>` +
      `<p style="margin:24px 0">` +
      `<a href="${params.link}" style="background:#0f7a4d;color:#fff;padding:12px 20px;` +
      `border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">` +
      `Choose a new password</a></p>` +
      `<p style="color:#555;font-size:14px">The link expires in 1 hour and can be used once.</p>` +
      `<p style="color:#555;font-size:14px">If you did not ask to reset your password, ` +
      `ignore this email — your current password still works.</p>` +
      `<p style="color:#888;font-size:12px;word-break:break-all">${params.link}</p>` +
      `</div>`,
  });
  if (!res.ok) console.error("[password-reset] email failed:", res.error);
  return { sent: res.ok, error: res.ok ? undefined : res.error };
}

"use server";

import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  isFundraiserCode,
} from "@/lib/validators/auth";
import {
  createPasswordResetToken,
  findValidResetToken,
  consumeResetToken,
  sendPasswordResetEmail,
} from "@/lib/auth/password-reset";

export type RequestResetState = { ok: boolean; message: string } | null;

/**
 * Step 1 — ask for a reset link.
 *
 * Accepts an email OR a fundraiser verification code (YWD-…): a fundraiser
 * remembers the code on their ID card more reliably than which email they used.
 * Either way the link is emailed to the address ON FILE — the code path never
 * reveals that address, so knowing a code cannot expose someone's email.
 *
 * Always reports the same thing whether or not the identifier matches an
 * account. Anything else turns this form into an oracle for checking who is
 * registered on the platform, which for a KYC-verified fundraiser is a privacy
 * leak, not just an inconvenience. The cooldown case is silent for the same
 * reason.
 */
export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const parsed = forgotPasswordSchema.safeParse({
    identifier: String(formData.get("identifier") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter your email or fundraiser code." };
  }

  const generic = {
    ok: true,
    message:
      "If that matches an account, we've sent a link to reset the password to " +
      "the email on file. Check your inbox — and your spam folder.",
  };

  const identifier = parsed.data.identifier.trim();
  const user = isFundraiserCode(identifier)
    ? (
        await db.campaignOwner.findUnique({
          where: { authorCode: identifier.toUpperCase() },
          select: {
            user: { select: { id: true, name: true, email: true, isBanned: true } },
          },
        })
      )?.user ?? null
    : await db.user.findUnique({
        where: { email: identifier.toLowerCase() },
        select: { id: true, name: true, email: true, isBanned: true },
      });
  if (!user || user.isBanned) return generic;

  const token = await createPasswordResetToken(user.id);
  if (!token.ok) return generic; // cooldown — stay silent

  // A missing NEXT_PUBLIC_APP_URL must not surface as a 500 on a public form.
  let link: string;
  try {
    link = `${appUrl()}/reset-password?token=${encodeURIComponent(token.token)}`;
  } catch {
    console.error("[password-reset] NEXT_PUBLIC_APP_URL is not set");
    return generic;
  }

  await sendPasswordResetEmail({ to: user.email, name: user.name, link });
  await writeAudit({
    actorId: user.id,
    action: "PASSWORD_RESET_REQUESTED",
    entityType: "User",
    entityId: user.id,
  });

  return generic;
}

export type ResetState = { ok: boolean; message: string } | null;

/** Step 2 — set the new password using the emailed token. */
export async function resetPasswordAction(
  _prev: ResetState,
  formData: FormData
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const parsed = resetPasswordSchema.safeParse({
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  });
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Check the password and try again.",
    };
  }

  const record = await findValidResetToken(token);
  if (!record) {
    return {
      ok: false,
      message:
        "This link is invalid or has expired. Request a new one and use the " +
        "most recent email.",
    };
  }

  await db.user.update({
    where: { id: record.userId },
    data: { passwordHash: await hashPassword(parsed.data.password) },
  });
  await consumeResetToken(record.id, record.userId);
  await writeAudit({
    actorId: record.userId,
    action: "PASSWORD_RESET_COMPLETED",
    entityType: "User",
    entityId: record.userId,
  });

  return { ok: true, message: "Your password has been changed. You can sign in now." };
}

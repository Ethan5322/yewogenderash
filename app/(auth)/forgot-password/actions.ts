"use server";

import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { hashPassword } from "@/lib/auth/password";
import { writeAudit } from "@/lib/audit";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators/auth";
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
 * Always reports the same thing whether or not the address has an account.
 * Anything else turns this form into an oracle for checking which people are
 * registered on the platform, which for a KYC-verified fundraiser is a privacy
 * leak, not just an inconvenience. The cooldown case is silent for the same
 * reason.
 */
export async function requestPasswordResetAction(
  _prev: RequestResetState,
  formData: FormData
): Promise<RequestResetState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });
  if (!parsed.success) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const generic = {
    ok: true,
    message:
      "If that email has an account, we've sent a link to reset the password. " +
      "Check your inbox — and your spam folder.",
  };

  const email = parsed.data.email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email },
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

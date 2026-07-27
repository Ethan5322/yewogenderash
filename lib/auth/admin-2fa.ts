import "server-only";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createOtp } from "@/lib/auth/otp";
import { sendWhatsApp } from "@/lib/notifications";

/** Mask a phone for display: keep the last 3 digits. */
function maskPhone(p: string): string {
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "your registered number";
  return `••••••${digits.slice(-3)}`;
}

export type AdminLoginStep =
  /** Main admin: a one-time code has been sent and must be entered. */
  | { ok: true; codeRequired: true; sentTo: string; delivered: boolean }
  /** Delegated admin: no second factor — the password alone signs them in. */
  | { ok: true; codeRequired: false }
  | { ok: false; error: string };

/**
 * Step 1 of admin sign-in: check email + password, then decide whether a second
 * factor is needed.
 *
 * The second factor is for the MAIN ADMIN only. They hold every capability,
 * including creating admins and changing fee settings, so theirs is the account
 * worth protecting beyond a password. A delegated (sub-)admin signs in with
 * their password alone — which also matches the staff-code route, where an admin
 * has always been able to sign in with their code plus a password or their face
 * and no second factor.
 *
 * The code goes to WhatsApp through CallMeBot. Errors are deliberately generic,
 * so this never reveals which addresses belong to admins or which admin is the
 * main one.
 */
export async function requestAdminLoginCode(
  email: string,
  password: string
): Promise<AdminLoginStep> {
  const e = email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email: e },
    select: {
      id: true,
      email: true,
      role: true,
      isBanned: true,
      isSuperAdmin: true,
      passwordHash: true,
    },
  });

  // Always run a password check shape so timing doesn't leak account existence.
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || user.isBanned || !valid || user.role !== "ADMIN") {
    return { ok: false, error: "Invalid admin credentials." };
  }

  // Delegated admins have no second factor; the password they just proved is
  // enough, and the caller signs them straight in.
  if (!user.isSuperAdmin) return { ok: true, codeRequired: false };

  const otp = await createOtp(user.id, "LOGIN_2FA");
  if (!otp.ok) {
    return { ok: false, error: "A code was just sent. Wait a minute before requesting another." };
  }

  // A CallMeBot API key is issued for ONE specific WhatsApp number, so the phone
  // and the key have to travel together. Admin accounts carry no per-user key
  // (that field belongs to campaign owners), so the platform pair is the only
  // combination that can actually deliver — pairing an admin's own phone with
  // the platform key would fail silently.
  const phone = process.env.ADMIN_WHATSAPP_PHONE || "";
  const apiKey = process.env.ADMIN_CALLMEBOT_APIKEY || "";
  const message = `Yewogen Derash — your main admin login code is ${otp.code}. It expires in 10 minutes. If you didn't request this, ignore it and change your password.`;

  // Also logged server-side so the code stays recoverable during setup, or if
  // WhatsApp is down and the main admin would otherwise be locked out.
  console.log(`[admin-2fa] LOGIN_2FA code for ${user.email}: ${otp.code}`);

  let delivered = false;
  if (phone && apiKey) {
    const sent = await sendWhatsApp(phone, apiKey, message).catch(() => ({
      ok: false as const,
      error: "request failed",
    }));
    delivered = sent.ok;
    if (!sent.ok) {
      console.warn(`[admin-2fa] WhatsApp delivery failed: ${sent.error ?? "unknown"}`);
    }
  } else {
    console.warn(
      "[admin-2fa] ADMIN_WHATSAPP_PHONE / ADMIN_CALLMEBOT_APIKEY not set — the code is in the server log only."
    );
  }

  return {
    ok: true,
    codeRequired: true,
    sentTo: phone ? maskPhone(phone) : "your registered channel",
    // Surfaced so the screen tells the truth rather than claiming a message was
    // sent when the request failed.
    delivered,
  };
}

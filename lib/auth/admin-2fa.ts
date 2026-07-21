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

/**
 * Step 1 of admin 2FA login: verify email + password, confirm the account is an
 * ADMIN, then issue and deliver a one-time login code (WhatsApp via CallMeBot).
 * Errors are deliberately generic to avoid revealing which accounts are admins.
 * The code is also logged server-side so it can be retrieved from logs during
 * setup/testing if WhatsApp delivery isn't available.
 */
export async function requestAdminLoginCode(
  email: string,
  password: string
): Promise<{ ok: true; sentTo: string } | { ok: false; error: string }> {
  const e = email.toLowerCase().trim();
  const user = await db.user.findUnique({
    where: { email: e },
    select: { id: true, email: true, role: true, isBanned: true, passwordHash: true, phone: true },
  });

  // Always run a password check shape so timing doesn't leak account existence.
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || user.isBanned || !valid || user.role !== "ADMIN") {
    return { ok: false, error: "Invalid admin credentials." };
  }

  const otp = await createOtp(user.id, "LOGIN_2FA");
  if (!otp.ok) {
    return { ok: false, error: "A code was just sent. Wait a minute before requesting another." };
  }

  const phone = user.phone || process.env.ADMIN_WHATSAPP_PHONE || "";
  const apiKey = process.env.ADMIN_CALLMEBOT_APIKEY || "";
  const message = `Yewogen Derash — your admin login code is ${otp.code}. It expires in 10 minutes. If you didn't request this, ignore it.`;

  // Server log so the code is retrievable during setup/testing.
  console.log(`[admin-2fa] LOGIN_2FA code for ${user.email}: ${otp.code}`);

  if (phone && apiKey) {
    await sendWhatsApp(phone, apiKey, message).catch(() => {});
  }

  return { ok: true, sentTo: phone ? maskPhone(phone) : "your registered channel" };
}

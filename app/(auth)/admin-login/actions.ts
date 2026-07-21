"use server";

import { requestAdminLoginCode } from "@/lib/auth/admin-2fa";

export type AdminCodeResult =
  | { ok: true; sentTo: string }
  | { ok: false; error: string };

/** Step 1: validate admin credentials and send the one-time login code. */
export async function requestAdminCodeAction(
  _prev: AdminCodeResult | null,
  formData: FormData
): Promise<AdminCodeResult> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, error: "Enter your admin email and password." };
  }
  return requestAdminLoginCode(email, password);
}

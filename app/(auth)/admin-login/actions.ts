"use server";

import { requestAdminLoginCode, type AdminLoginStep } from "@/lib/auth/admin-2fa";

export type AdminCodeResult = AdminLoginStep;

/**
 * Step 1: check admin credentials, then either send the main admin a one-time
 * code or tell the screen that this admin needs no second factor.
 */
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

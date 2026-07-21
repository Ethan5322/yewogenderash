import "server-only";

/**
 * Transactional email via Resend's REST API (no SDK — a single fetch).
 *
 * Configure (free tier at resend.com):
 *   RESEND_API_KEY = re_...
 *   EMAIL_FROM     = "Yewogen Derash <onboarding@yourdomain.com>"
 *                    (or "onboarding@resend.dev" for testing to your own inbox)
 *
 * When unset, callers fall back to the dev console + on-screen code.
 */
export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "email not configured" };
  const from = process.env.EMAIL_FROM || "Yewogen Derash <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        text: params.text,
        ...(params.html ? { html: params.html } : {}),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 200)}` };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

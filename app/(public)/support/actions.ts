"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { sendEmail, emailConfigured } from "@/lib/email";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  type: z.enum(["CONTACT", "REPORT"]),
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.email("Enter a valid email").max(190),
  code: z.string().trim().max(200).optional().or(z.literal("")),
  reason: z.string().trim().max(80).optional().or(z.literal("")),
  message: z.string().trim().min(5, "Add a little more detail").max(4000),
  website: z.string().optional(), // honeypot
});

/**
 * Public contact / abuse-report submission. Really stores the message (Support
 * inbox) and best-effort emails an administrator — no more silent "delivery
 * being connected" placeholder.
 */
export async function submitSupportMessageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const parsed = schema.safeParse({
    type: formData.get("type"),
    name: formData.get("name"),
    email: formData.get("email"),
    code: formData.get("code") ?? "",
    reason: formData.get("reason") ?? "",
    message: formData.get("message"),
    website: formData.get("website") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }
  // Honeypot: silently succeed for bots, store nothing.
  if (parsed.data.website && parsed.data.website.trim() !== "") {
    return { ok: true };
  }

  const d = parsed.data;
  const msg = await db.supportMessage.create({
    data: {
      type: d.type,
      name: d.name,
      email: d.email,
      code: d.code || null,
      reason: d.reason || null,
      message: d.message,
    },
    select: { id: true },
  });

  await writeAudit({
    action: d.type === "REPORT" ? "SUPPORT_REPORT_RECEIVED" : "SUPPORT_CONTACT_RECEIVED",
    entityType: "SupportMessage",
    entityId: msg.id,
    detail: { email: d.email, reason: d.reason || undefined },
  });

  // Best-effort admin notification (never blocks the user if email is down).
  if (emailConfigured()) {
    const admin = await db.user.findFirst({
      where: { role: "ADMIN", isSuperAdmin: true },
      select: { email: true },
      orderBy: { createdAt: "asc" },
    });
    if (admin?.email) {
      await sendEmail({
        to: admin.email,
        subject:
          d.type === "REPORT"
            ? `New abuse report on Yewogen Derash`
            : `New contact message on Yewogen Derash`,
        text:
          `Type: ${d.type}\nFrom: ${d.name} <${d.email}>\n` +
          (d.code ? `Campaign: ${d.code}\n` : "") +
          (d.reason ? `Reason: ${d.reason}\n` : "") +
          `\n${d.message}\n\nReview in the admin Support inbox.`,
      }).catch(() => null);
    }
  }

  return { ok: true };
}

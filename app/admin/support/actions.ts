"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Mark a contact message / abuse report resolved (or reopen it). */
export async function setSupportStatusAction(
  id: string,
  status: "OPEN" | "RESOLVED"
): Promise<ActionResult> {
  const admin = await requirePermission("messages");
  const existing = await db.supportMessage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Message not found." };

  await db.supportMessage.update({ where: { id }, data: { status } });
  await writeAudit({
    actorId: admin.id,
    action: status === "RESOLVED" ? "SUPPORT_RESOLVED" : "SUPPORT_REOPENED",
    entityType: "SupportMessage",
    entityId: id,
  });
  revalidatePath("/admin/support");
  return { ok: true };
}

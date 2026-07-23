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

/** Hand a case to a specific admin (or clear the assignment). */
export async function assignSupportAction(
  id: string,
  assignedToId: string | null
): Promise<ActionResult> {
  const admin = await requirePermission("messages");
  const existing = await db.supportMessage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Message not found." };

  if (assignedToId) {
    const target = await db.user.findFirst({
      where: { id: assignedToId, role: "ADMIN" },
      select: { id: true, name: true },
    });
    if (!target) return { ok: false, error: "That admin no longer exists." };
  }

  await db.supportMessage.update({
    where: { id },
    data: {
      assignedToId,
      assignedAt: assignedToId ? new Date() : null,
    },
  });
  await writeAudit({
    actorId: admin.id,
    action: assignedToId ? "SUPPORT_ASSIGNED" : "SUPPORT_UNASSIGNED",
    entityType: "SupportMessage",
    entityId: id,
    detail: assignedToId ? { assignedToId } : undefined,
  });
  revalidatePath("/admin/support");
  return { ok: true };
}

/** Save an internal note on a case (visible to admins only). */
export async function saveSupportNoteAction(
  id: string,
  note: string
): Promise<ActionResult> {
  const admin = await requirePermission("messages");
  const existing = await db.supportMessage.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { ok: false, error: "Message not found." };

  const clean = note.trim().slice(0, 2000);
  await db.supportMessage.update({
    where: { id },
    data: { adminNote: clean || null },
  });
  await writeAudit({
    actorId: admin.id,
    action: "SUPPORT_NOTE_SAVED",
    entityType: "SupportMessage",
    entityId: id,
  });
  revalidatePath("/admin/support");
  return { ok: true };
}

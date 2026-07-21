"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

const replySchema = z.object({
  ownerId: z.string().min(1),
  body: z.string().trim().min(2, "Write a reply").max(4000, "Reply is too long"),
});

const broadcastSchema = z.object({
  subject: z.string().trim().min(2, "Add a subject").max(160),
  body: z.string().trim().min(2, "Write the notice").max(4000, "Notice is too long"),
});

/** Admin replies to one fundraiser's thread. */
export async function replyToOwnerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("messages");
  const parsed = replySchema.safeParse({
    ownerId: formData.get("ownerId"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your reply" };
  }

  const owner = await db.campaignOwner.findUnique({
    where: { id: parsed.data.ownerId },
    select: { id: true },
  });
  if (!owner) return { ok: false, error: "Fundraiser not found." };

  await db.message.create({
    data: {
      ownerId: owner.id,
      senderUserId: admin.id,
      fromAdmin: true,
      body: parsed.data.body,
      readByAdmin: true,
      readByOwner: false,
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "ADMIN_MESSAGE_REPLY",
    entityType: "CampaignOwner",
    entityId: owner.id,
  });

  revalidatePath(`/admin/messages/${owner.id}`);
  revalidatePath("/admin/messages");
  return { ok: true };
}

/**
 * Admin sends ONE notice to every fundraiser at once (a broadcast). Stored as a
 * single shared row (ownerId null, isBroadcast true) that appears in every
 * fundraiser's thread.
 */
export async function broadcastNoticeAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("messages");
  const parsed = broadcastSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the notice" };
  }

  await db.message.create({
    data: {
      ownerId: null,
      senderUserId: admin.id,
      fromAdmin: true,
      isBroadcast: true,
      subject: parsed.data.subject,
      body: parsed.data.body,
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "ADMIN_BROADCAST_NOTICE",
    detail: { subject: parsed.data.subject },
  });

  revalidatePath("/admin/messages");
  return { ok: true };
}

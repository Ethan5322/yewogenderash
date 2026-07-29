"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/admin/permissions";
import { sendStaffMessage } from "@/lib/admin/staffMessages";
import { writeAudit } from "@/lib/audit";

/**
 * Post a message on the internal staff line.
 *
 * Guarded by currentAdmin() and nothing else — no requirePermission call. The
 * staff line is open to every admin by design, so that a sub-admin holding only
 * `kyc` can still answer the main admin. currentAdmin() already redirects any
 * non-admin, which is the whole access rule here.
 */
export async function sendStaffMessageAction(formData: FormData) {
  const me = await currentAdmin();

  const peerId = String(formData.get("peerId") ?? "").trim();
  const body = String(formData.get("body") ?? "");
  if (!peerId || !body.trim()) return;

  // Returns null when the recipient is not an admin, so a tampered peerId
  // cannot post into a donor's or a fundraiser's records.
  const sent = await sendStaffMessage(me.id, peerId, body);
  if (!sent) return;

  // The event, never the body. Anyone holding the `audit` capability can read
  // the audit log, and staff conversations are not theirs to read — the text
  // stays in the thread, visible only to its two participants.
  await writeAudit({
    actorId: me.id,
    action: "staff_message.sent",
    entityType: "user",
    entityId: peerId,
    detail: { to: sent.peerName, chars: sent.chars },
  });

  revalidatePath("/admin/team-chat");
}

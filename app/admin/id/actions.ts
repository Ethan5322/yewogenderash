"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { currentAdmin } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";
import { parseDescriptor } from "@/lib/face/distance";
import {
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
  uploadMediaFile,
} from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Staff identity (admins & sub-admins). Unlike a fundraiser — whose portrait and
 * biometric are frozen at verification to protect donors — staff credentials are
 * operational: an admin maintains their own ID photo and face template, and the
 * main admin can set them for a sub-admin (typically at creation, in person).
 * The face template here is a sign-in factor on /admin-login.
 */

/**
 * Resolve whose record is being edited. An admin may always edit their own;
 * only the main (super) admin may edit another admin's.
 */
async function resolveTarget(
  targetId: FormDataEntryValue | null
): Promise<
  | { ok: true; actorId: string; userId: string; self: boolean }
  | { ok: false; error: string }
> {
  const admin = await currentAdmin();
  const wanted = typeof targetId === "string" && targetId ? targetId : admin.id;
  if (wanted === admin.id) {
    return { ok: true, actorId: admin.id, userId: admin.id, self: true };
  }
  if (!admin.isSuperAdmin) {
    return { ok: false, error: "Only the main admin can change another admin's ID." };
  }
  const target = await db.user.findUnique({
    where: { id: wanted },
    select: { id: true, role: true },
  });
  if (!target || target.role !== "ADMIN") return { ok: false, error: "Admin not found." };
  return { ok: true, actorId: admin.id, userId: target.id, self: false };
}

/** Upload/replace a staff ID portrait (gallery photo, cropped 3:4 client-side). */
export async function uploadStaffPhotoAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const target = await resolveTarget(formData.get("targetId"));
  if (!target.ok) return target;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Use a JPEG, PNG or WebP image." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "That image is too large — keep it under 5 MB." };
  }

  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const up = await uploadMediaFile(
    `staff/${target.userId}/id-${Date.now()}.${ext}`,
    new Uint8Array(await file.arrayBuffer()),
    file.type
  );
  if (!up.ok) return { ok: false, error: `Upload failed: ${up.error}` };

  await db.user.update({ where: { id: target.userId }, data: { idPhotoUrl: up.url } });
  await writeAudit({
    actorId: target.actorId,
    action: "ADMIN_ID_PHOTO_UPDATED",
    entityType: "User",
    entityId: target.userId,
    detail: { self: target.self },
  });

  revalidatePath("/admin/id");
  revalidatePath("/admin/team");
  return { ok: true };
}

/**
 * Enrol (or re-enrol) a staff face template. This is the biometric an admin
 * signs in with, so it can be refreshed at any time — a new capture simply
 * replaces the old template.
 */
export async function enrolStaffFaceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const target = await resolveTarget(formData.get("targetId"));
  if (!target.ok) return target;

  const descriptor = parseDescriptor(formData.get("descriptor"));
  if (!descriptor) {
    return { ok: false, error: "No face was detected in the capture. Please retake." };
  }

  await db.user.update({
    where: { id: target.userId },
    data: {
      faceDescriptor: JSON.stringify(descriptor),
      biometricEnrolledAt: new Date(),
    },
  });
  await writeAudit({
    actorId: target.actorId,
    action: "ADMIN_BIOMETRIC_ENROLLED",
    entityType: "User",
    entityId: target.userId,
    detail: { self: target.self, liveness: formData.get("liveness") === "passed" },
  });

  revalidatePath("/admin/id");
  revalidatePath("/admin/team");
  return { ok: true };
}

/**
 * Remove a staff face template. The account falls back to email + emailed 2FA
 * code until a new face is enrolled.
 */
export async function clearStaffFaceAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const target = await resolveTarget(formData.get("targetId"));
  if (!target.ok) return target;

  await db.user.update({
    where: { id: target.userId },
    data: { faceDescriptor: null, biometricEnrolledAt: null },
  });
  await writeAudit({
    actorId: target.actorId,
    action: "ADMIN_BIOMETRIC_CLEARED",
    entityType: "User",
    entityId: target.userId,
    detail: { self: target.self },
  });

  revalidatePath("/admin/id");
  revalidatePath("/admin/team");
  return { ok: true };
}

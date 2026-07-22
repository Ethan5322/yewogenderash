"use server";

import { revalidatePath } from "next/cache";
import { currentAdmin } from "@/lib/admin/permissions";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  uploadMediaFile,
  MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/supabase/server";

export type ActionResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Enrol the signed-in admin's staff biometric portrait. The photo is
 * client-cropped to a 3:4 portrait and shown on their staff ID; an optional
 * face descriptor is stored as the biometric template. Each admin enrols their
 * own — never another account's.
 */
export async function uploadAdminPhotoAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await currentAdmin();

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose a photo to upload." };
  }
  if (!ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])) {
    return { ok: false, error: "Use a JPG, PNG, or WebP image." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Image is larger than 5 MB." };
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const path = `staff/${admin.id}/id-photo-${Date.now()}.jpg`;
  const up = await uploadMediaFile(path, buffer, "image/jpeg");
  if (!up.ok) return { ok: false, error: `Upload failed: ${up.error}` };

  const descriptorRaw = formData.get("descriptor");
  const faceDescriptor = typeof descriptorRaw === "string" && descriptorRaw.length > 2
    ? descriptorRaw
    : null;

  await db.user.update({
    where: { id: admin.id },
    data: {
      idPhotoUrl: up.url,
      biometricEnrolledAt: new Date(),
      ...(faceDescriptor ? { faceDescriptor } : {}),
    },
  });

  await writeAudit({
    actorId: admin.id,
    action: "ADMIN_BIOMETRIC_ENROLLED",
    entityType: "User",
    entityId: admin.id,
    detail: { hasDescriptor: !!faceDescriptor },
  });

  revalidatePath("/admin/id");
  return { ok: true, url: up.url };
}

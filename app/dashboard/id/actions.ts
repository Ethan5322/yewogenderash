"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { uploadMediaFile, MAX_UPLOAD_BYTES, ALLOWED_IMAGE_TYPES } from "@/lib/supabase/server";

export type ActionResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * Save the fundraiser's ID-card portrait. The image arrives already
 * center-cropped to a 3:4 portrait client-side (see id-photo-upload.tsx); the
 * server still validates type and size before uploading to the PUBLIC media
 * bucket (this photo is shown ON the ID card, unlike the private KYC selfie).
 */
export async function uploadIdPhotoAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { id: true, userId: true },
  });
  if (!owner) redirect("/start");

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
  const path = `owners/${owner.id}/id-photo-${Date.now()}.jpg`;
  const up = await uploadMediaFile(path, buffer, "image/jpeg");
  if (!up.ok) return { ok: false, error: `Upload failed: ${up.error}` };

  await db.campaignOwner.update({
    where: { id: owner.id },
    data: { idPhotoUrl: up.url },
  });

  await writeAudit({
    actorId: owner.userId,
    action: "ID_PHOTO_UPDATED",
    entityType: "CampaignOwner",
    entityId: owner.id,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/id");
  return { ok: true, url: up.url };
}

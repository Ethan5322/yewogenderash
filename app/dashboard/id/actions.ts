"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  uploadMediaFile,
  signedKycUrl,
  MAX_UPLOAD_BYTES,
  ALLOWED_IMAGE_TYPES,
} from "@/lib/supabase/server";
import { faceDistance, parseDescriptor, MATCH_THRESHOLD } from "@/lib/face/distance";
import { faceServiceConfigured, faceCompare } from "@/lib/face/service";

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
    select: { id: true, userId: true, faceDescriptor: true },
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

  // Same-person match between the live biometric selfie and this ID photo.
  // Prefer the high-accuracy InsightFace service when configured; otherwise use
  // the in-browser face-api descriptors the client sent.
  const idDesc = parseDescriptor(formData.get("descriptor"));
  let faceMatched: boolean | undefined;
  let matchScore: number | undefined;
  let faceEngine: string | undefined;

  if (faceServiceConfigured()) {
    const selfieDoc = await db.verificationDocument.findFirst({
      where: { ownerId: owner.id, documentType: "SELFIE" },
      orderBy: { createdAt: "desc" },
      select: { fileUrl: true },
    });
    const selfieUrl = selfieDoc ? await signedKycUrl(selfieDoc.fileUrl, 600) : null;
    if (selfieUrl) {
      const cmp = await faceCompare(selfieUrl, up.url);
      if (cmp) {
        faceMatched = cmp.samePerson;
        matchScore = cmp.similarity;
        faceEngine = "insightface";
      }
    }
  }
  if (faceEngine === undefined) {
    const selfieDesc = parseDescriptor(owner.faceDescriptor);
    if (idDesc && selfieDesc) {
      const d = faceDistance(selfieDesc, idDesc);
      matchScore = d;
      faceMatched = d < MATCH_THRESHOLD;
      faceEngine = "face-api";
    }
  }

  await db.campaignOwner.update({
    where: { id: owner.id },
    data: {
      idPhotoUrl: up.url,
      ...(idDesc ? { idPhotoDescriptor: idDesc as Prisma.InputJsonValue } : {}),
      ...(matchScore !== undefined ? { faceMatchScore: matchScore } : {}),
      ...(faceMatched !== undefined ? { faceMatched } : {}),
      ...(faceEngine !== undefined ? { faceEngine } : {}),
    },
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

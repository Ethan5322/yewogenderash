import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyCaptureToken } from "@/lib/capture-token";
import { uploadKycFile, MAX_UPLOAD_BYTES } from "@/lib/supabase/server";
import { parseDescriptor, faceDistance } from "@/lib/face/distance";
import { writeAudit } from "@/lib/audit";
import { rateLimit, ipKey, tooManyResponse } from "@/lib/rate-limit";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Phone → laptop biometric handoff. A phone (not logged in) uploads the live
 * selfie for an owner, authorised ONLY by the short-lived capture token in the
 * URL. Stores the selfie + face descriptor exactly like the on-computer path,
 * so the reviewer sees the same evidence. livenessPassed is false here (the
 * phone path is a no-camera fallback; the admin still reviews + face-matches).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const limit = rateLimit(ipKey(req, "capture"), 12, 10 * 60_000);
  if (!limit.ok) return tooManyResponse(limit);

  const { token } = await params;
  const ownerId = verifyCaptureToken(token);
  if (!ownerId) {
    return NextResponse.json({ error: "This capture link is invalid or expired." }, { status: 401 });
  }

  const owner = await db.campaignOwner.findUnique({
    where: { id: ownerId },
    select: { id: true, userId: true, idPhotoDescriptor: true },
  });
  if (!owner) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const form = await req.formData().catch(() => null);
  const file = form?.get("selfie");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No image received." }, { status: 400 });
  }
  if (!(file.type in EXT)) {
    return NextResponse.json({ error: "Use a JPG, PNG, or WebP image." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "Image is larger than 5 MB." }, { status: 400 });
  }

  const descriptor = parseDescriptor(form?.get("descriptor"));
  if (!descriptor) {
    return NextResponse.json({ error: "No clear face detected. Retake." }, { status: 400 });
  }

  const path = `owners/${owner.id}/selfie-${Date.now()}.${EXT[file.type]}`;
  const up = await uploadKycFile(path, new Uint8Array(await file.arrayBuffer()), file.type);
  if (!up.ok) return NextResponse.json({ error: `Upload failed: ${up.error}` }, { status: 502 });

  const idDesc = parseDescriptor(owner.idPhotoDescriptor);
  const matchScore = idDesc ? faceDistance(descriptor, idDesc) : undefined;

  await db.$transaction([
    db.verificationDocument.deleteMany({ where: { ownerId: owner.id, documentType: "SELFIE" } }),
    db.verificationDocument.create({
      data: { ownerId: owner.id, documentType: "SELFIE", fileUrl: path },
    }),
    db.campaignOwner.update({
      where: { id: owner.id },
      data: {
        biometricStatus: "PENDING",
        faceDescriptor: descriptor as Prisma.InputJsonValue,
        livenessPassed: false,
        ...(matchScore !== undefined ? { faceMatchScore: matchScore } : {}),
      },
    }),
  ]);

  await writeAudit({
    actorId: owner.userId,
    action: "OWNER_BIOMETRIC_CAPTURED_MOBILE",
    entityType: "CampaignOwner",
    entityId: owner.id,
  });

  return NextResponse.json({ ok: true });
}

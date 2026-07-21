"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { faceDistance, parseDescriptor } from "@/lib/face/distance";
import {
  ensureOwnerProfile,
  getOwnerContext,
  computeOnboardingState,
  canSubmitForReview,
} from "@/lib/owner";
import {
  consentSchema,
  payoutAccountSchema,
  ownerIdentitySchema,
  uploadDocTypeSchema,
} from "@/lib/validators/onboarding";
import {
  uploadKycFile,
  MAX_UPLOAD_BYTES,
  ALLOWED_DOC_TYPES,
} from "@/lib/supabase/server";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");
  return session.user.id;
}

/** Validate an uploaded file (type + size). The bytes are read by the caller. */
function readUpload(
  value: FormDataEntryValue | null
): { ok: true; type: string } | { ok: false; error: string } {
  if (!(value instanceof File) || value.size === 0) {
    return { ok: false, error: "Please attach a file" };
  }
  if (!(ALLOWED_DOC_TYPES as readonly string[]).includes(value.type)) {
    return { ok: false, error: "Unsupported file type (use JPG, PNG, WEBP, or PDF)" };
  }
  if (value.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "File is too large (maximum 5 MB)" };
  }
  return { ok: true, type: value.type };
}

// ── Phone number (so it can be OTP-verified) ─────────────────────
const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{9,15}$/, "Enter a valid phone number (e.g. +2519...)"),
});

export async function updatePhoneAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = phoneSchema.safeParse({ phone: formData.get("phone") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid phone" };
  }
  const phone = parsed.data.phone.replace(/[\s-]/g, "");

  const clash = await db.user.findFirst({
    where: { phone, id: { not: userId } },
    select: { id: true },
  });
  if (clash) {
    return { ok: false, error: "That phone number is already in use." };
  }

  // Changing the number invalidates any prior phone verification.
  await db.user.update({
    where: { id: userId },
    data: { phone, phoneVerifiedAt: null },
  });
  revalidatePath("/start/verify");
  return { ok: true };
}

// ── Terms, fees & biometric consent ──────────────────────────────
export async function saveConsentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const parsed = consentSchema.safeParse({
    acceptTerms: formData.get("acceptTerms") === "on",
    acceptFees: formData.get("acceptFees") === "on",
    biometricConsent: formData.get("biometricConsent") === "on",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Please accept all terms" };
  }

  await ensureOwnerProfile(userId);
  const now = new Date();
  await db.campaignOwner.update({
    where: { userId },
    data: { termsAcceptedAt: now, feesAcceptedAt: now, biometricConsentAt: now },
  });
  await writeAudit({
    actorId: userId,
    action: "OWNER_CONSENT_ACCEPTED",
    entityType: "CampaignOwner",
  });
  redirect("/start/documents");
}

// ── Identity, payout & documents (single step) ───────────────────
export async function saveDocumentsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();

  const identity = ownerIdentitySchema.safeParse({
    idNumber: formData.get("idNumber"),
  });
  if (!identity.success) {
    return {
      ok: false,
      error: identity.error.issues[0]?.message ?? "Enter your ID number",
    };
  }

  const payout = payoutAccountSchema.safeParse({
    accountType: formData.get("accountType"),
    accountName: formData.get("accountName"),
    accountNumber: formData.get("accountNumber"),
    bankName: formData.get("bankName") ?? "",
  });
  if (!payout.success) {
    return {
      ok: false,
      error: payout.error.issues[0]?.message ?? "Check your payout details",
    };
  }

  // Primary ID must be an identity document; supporting must not be one —
  // otherwise the onboarding state machine would never see both requirements met.
  const primaryType = z
    .enum(["NATIONAL_ID", "PASSPORT"])
    .safeParse(formData.get("primaryIdType"));
  const supportingType = uploadDocTypeSchema
    .refine((t) => t !== "NATIONAL_ID" && t !== "PASSPORT")
    .safeParse(formData.get("supportingType"));
  if (!primaryType.success || !supportingType.success) {
    return { ok: false, error: "Choose a valid document type for each upload" };
  }

  const primary = readUpload(formData.get("primaryIdFile"));
  if (!primary.ok) return { ok: false, error: `ID document: ${primary.error}` };
  const supporting = readUpload(formData.get("supportingFile"));
  if (!supporting.ok) return { ok: false, error: `Supporting document: ${supporting.error}` };

  const owner = await ensureOwnerProfile(userId);

  // Persist identity + payout details.
  await db.campaignOwner.update({
    where: { id: owner.id },
    data: {
      idNumber: identity.data.idNumber,
      payoutAccount: {
        accountType: payout.data.accountType,
        accountName: payout.data.accountName,
        accountNumber: payout.data.accountNumber,
        bankName: payout.data.bankName || null,
      },
    },
  });

  // Upload files and (re)create the two document rows.
  const stamp = Date.now();
  const primaryFile = formData.get("primaryIdFile") as File;
  const supportingFile = formData.get("supportingFile") as File;

  const primaryPath = `owners/${owner.id}/${primaryType.data.toLowerCase()}-${stamp}.${EXT[primary.type]}`;
  const supportingPath = `owners/${owner.id}/${supportingType.data.toLowerCase()}-${stamp}.${EXT[supporting.type]}`;

  const up1 = await uploadKycFile(
    primaryPath,
    new Uint8Array(await primaryFile.arrayBuffer()),
    primary.type
  );
  if (!up1.ok) return { ok: false, error: `ID upload failed: ${up1.error}` };
  const up2 = await uploadKycFile(
    supportingPath,
    new Uint8Array(await supportingFile.arrayBuffer()),
    supporting.type
  );
  if (!up2.ok) return { ok: false, error: `Supporting upload failed: ${up2.error}` };

  await db.$transaction([
    db.verificationDocument.deleteMany({
      where: { ownerId: owner.id, documentType: { in: [primaryType.data, supportingType.data] } },
    }),
    db.verificationDocument.create({
      data: { ownerId: owner.id, documentType: primaryType.data, fileUrl: primaryPath },
    }),
    db.verificationDocument.create({
      data: { ownerId: owner.id, documentType: supportingType.data, fileUrl: supportingPath },
    }),
  ]);

  await writeAudit({
    actorId: userId,
    action: "OWNER_DOCUMENTS_SUBMITTED",
    entityType: "CampaignOwner",
    entityId: owner.id,
  });

  redirect("/start/review");
}

// ── Biometric selfie capture ─────────────────────────────────────
export async function captureBiometricAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const userId = await requireUserId();
  const selfie = readUpload(formData.get("selfie"));
  if (!selfie.ok) return { ok: false, error: selfie.error };

  const owner = await ensureOwnerProfile(userId);
  const selfieFile = formData.get("selfie") as File;
  const path = `owners/${owner.id}/selfie-${Date.now()}.${EXT[selfie.type]}`;

  const up = await uploadKycFile(
    path,
    new Uint8Array(await selfieFile.arrayBuffer()),
    selfie.type
  );
  if (!up.ok) return { ok: false, error: `Selfie upload failed: ${up.error}` };

  // Real biometric: the browser detected a face and sent its 128-D descriptor
  // (the enrolment template). Reject a capture with no face — a blank/spoofed
  // frame can never enrol.
  const descriptor = parseDescriptor(formData.get("descriptor"));
  if (!descriptor) {
    return { ok: false, error: "No face was detected in the capture. Please retake." };
  }
  // If the ID-card photo was already analysed, refresh the match distance now.
  const existing = await db.campaignOwner.findUnique({
    where: { id: owner.id },
    select: { idPhotoDescriptor: true },
  });
  const idDesc = parseDescriptor(existing?.idPhotoDescriptor);
  const matchScore = idDesc ? faceDistance(descriptor, idDesc) : undefined;

  await db.$transaction([
    db.verificationDocument.deleteMany({
      where: { ownerId: owner.id, documentType: "SELFIE" },
    }),
    db.verificationDocument.create({
      data: { ownerId: owner.id, documentType: "SELFIE", fileUrl: path },
    }),
    db.campaignOwner.update({
      where: { id: owner.id },
      data: {
        biometricStatus: "PENDING",
        faceDescriptor: descriptor as Prisma.InputJsonValue,
        livenessPassed: formData.get("liveness") === "passed",
        ...(matchScore !== undefined ? { faceMatchScore: matchScore } : {}),
      },
    }),
  ]);

  await writeAudit({
    actorId: userId,
    action: "OWNER_BIOMETRIC_CAPTURED",
    entityType: "CampaignOwner",
    entityId: owner.id,
  });

  revalidatePath("/start/review");
  return { ok: true };
}

// ── Submit the whole application for admin review ────────────────
export async function submitForReviewAction(): Promise<ActionResult> {
  const userId = await requireUserId();
  const ctx = await getOwnerContext(userId);
  if (!ctx) return { ok: false, error: "Profile not found" };

  const state = computeOnboardingState(ctx);
  if (!canSubmitForReview(state)) {
    return { ok: false, error: "Please complete every step before submitting." };
  }

  await db.user.update({
    where: { id: userId },
    data: { verificationStatus: "PENDING" },
  });
  await writeAudit({
    actorId: userId,
    action: "OWNER_SUBMITTED_FOR_REVIEW",
    entityType: "User",
    entityId: userId,
  });

  revalidatePath("/start/review");
  redirect("/dashboard?submitted=1");
}

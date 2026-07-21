"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { DocumentType } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { campaignCreateSchema } from "@/lib/validators/campaign";
import { generateUniqueQueryCode, generateUniqueSlug } from "@/lib/querycode";
import { CATEGORY_PROOF } from "@/lib/campaign-types";
import {
  uploadMediaFile,
  uploadKycFile,
  ALLOWED_IMAGE_TYPES,
  MAX_UPLOAD_BYTES,
} from "@/lib/supabase/server";

// Proof document (private) accepts images + PDF.
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const PROOF_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export type ActionResult = { ok: true } | { ok: false; error: string };

// Anti-spam: an owner may have at most this many campaigns that are not
// archived/rejected. Raising it is an admin/product decision, not a code edit
// buried in a form handler.
const MAX_OPEN_CAMPAIGNS = 3;

const IMG_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Verified owner gate — creation is impossible before admin KYC approval. */
async function requireVerifiedOwner() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/campaigns");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: { ownerProfile: true },
  });
  if (!user) redirect("/login?callbackUrl=/dashboard/campaigns");
  if (user.isBanned) redirect("/");
  if (user.verificationStatus !== "VERIFIED" || !user.ownerProfile) {
    redirect("/start");
  }
  return { user, owner: user.ownerProfile };
}

export async function createCampaignAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { user, owner } = await requireVerifiedOwner();

  const parsed = campaignCreateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    story: formData.get("story"),
    category: formData.get("category"),
    targetAmount: formData.get("targetAmount"),
    location: formData.get("location") ?? "",
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  // Anti-fraud: a category-matched proof document is MANDATORY for every
  // campaign (brief §6.1/§6.2). Validate before anything is created.
  const proof = formData.get("proofDocument");
  if (!(proof instanceof File) || proof.size === 0) {
    return { ok: false, error: "Attach the required proof document for this campaign." };
  }
  if (!PROOF_TYPES.includes(proof.type)) {
    return { ok: false, error: "Proof must be a JPG, PNG, WEBP, or PDF." };
  }
  if (proof.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Proof document is too large (maximum 5 MB)." };
  }

  const openCount = await db.campaign.count({
    where: { ownerId: owner.id, status: { notIn: ["ARCHIVED", "REJECTED"] } },
  });
  if (openCount >= MAX_OPEN_CAMPAIGNS) {
    return {
      ok: false,
      error: `You already have ${openCount} open campaigns. Archive or complete one first, or contact support.`,
    };
  }

  // Optional hero image → public media bucket.
  let heroImageUrl: string | null = null;
  const hero = formData.get("heroImage");
  if (hero instanceof File && hero.size > 0) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(hero.type)) {
      return { ok: false, error: "Hero image must be a JPG, PNG, or WEBP" };
    }
    if (hero.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: "Hero image is too large (maximum 5 MB)" };
    }
    const path = `campaigns/${owner.id}/hero-${Date.now()}.${IMG_EXT[hero.type]}`;
    const up = await uploadMediaFile(
      path,
      new Uint8Array(await hero.arrayBuffer()),
      hero.type
    );
    if (!up.ok) return { ok: false, error: `Image upload failed: ${up.error}` };
    heroImageUrl = up.url;
  }

  const [slug, queryCode] = await Promise.all([
    generateUniqueSlug(parsed.data.title),
    generateUniqueQueryCode(),
  ]);

  const campaign = await db.campaign.create({
    data: {
      ownerId: owner.id,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      story: parsed.data.story,
      category: parsed.data.category,
      targetAmount: parsed.data.targetAmount,
      queryCode,
      heroImageUrl,
      location: parsed.data.location || null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      status: "DRAFT",
    },
  });

  // Store the proof privately and attach it to THIS campaign. If the upload
  // fails, roll the campaign back so we never keep an unverified campaign.
  const proofPath = `campaigns/${owner.id}/proof-${campaign.id}-${Date.now()}.${PROOF_EXT[proof.type]}`;
  const proofUp = await uploadKycFile(
    proofPath,
    new Uint8Array(await proof.arrayBuffer()),
    proof.type
  );
  if (!proofUp.ok) {
    await db.campaign.delete({ where: { id: campaign.id } });
    return { ok: false, error: `Proof upload failed: ${proofUp.error}` };
  }
  await db.campaignDocument.create({
    data: {
      campaignId: campaign.id,
      documentType: CATEGORY_PROOF[parsed.data.category].docType as DocumentType,
      fileUrl: proofPath,
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "CAMPAIGN_CREATED",
    entityType: "Campaign",
    entityId: campaign.id,
    detail: { title: campaign.title, queryCode, proofType: CATEGORY_PROOF[parsed.data.category].docType },
  });

  redirect(`/dashboard/campaigns?created=${campaign.slug}`);
}

/**
 * Owner edits their own campaign's CONTENT (title, story, image, target, etc.).
 * Ownership is enforced in the WHERE clause. Money, status, querycode, and the
 * featured flag are never touched here — those stay admin-only. The slug is
 * kept stable so existing links/QRs never break. Archived/completed campaigns
 * are locked.
 */
export async function updateCampaignAction(
  campaignId: string,
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { user, owner } = await requireVerifiedOwner();

  const parsed = campaignCreateSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    story: formData.get("story"),
    category: formData.get("category"),
    targetAmount: formData.get("targetAmount"),
    location: formData.get("location") ?? "",
    endDate: formData.get("endDate") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  const existing = await db.campaign.findFirst({
    where: { id: campaignId, ownerId: owner.id },
    select: { id: true, status: true, slug: true },
  });
  if (!existing) return { ok: false, error: "Campaign not found." };
  if (existing.status === "ARCHIVED" || existing.status === "COMPLETED") {
    return { ok: false, error: "This campaign can no longer be edited." };
  }

  // Optional replacement hero image → public media bucket. No file = keep current.
  let heroImageUrl: string | undefined;
  const hero = formData.get("heroImage");
  if (hero instanceof File && hero.size > 0) {
    if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(hero.type)) {
      return { ok: false, error: "Hero image must be a JPG, PNG, or WEBP" };
    }
    if (hero.size > MAX_UPLOAD_BYTES) {
      return { ok: false, error: "Hero image is too large (maximum 5 MB)" };
    }
    const path = `campaigns/${owner.id}/hero-${Date.now()}.${IMG_EXT[hero.type]}`;
    const up = await uploadMediaFile(
      path,
      new Uint8Array(await hero.arrayBuffer()),
      hero.type
    );
    if (!up.ok) return { ok: false, error: `Image upload failed: ${up.error}` };
    heroImageUrl = up.url;
  }

  await db.campaign.update({
    where: { id: existing.id },
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      story: parsed.data.story,
      category: parsed.data.category,
      targetAmount: parsed.data.targetAmount,
      location: parsed.data.location || null,
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      ...(heroImageUrl ? { heroImageUrl } : {}),
    },
  });

  await writeAudit({
    actorId: user.id,
    action: "CAMPAIGN_EDITED",
    entityType: "Campaign",
    entityId: existing.id,
  });

  revalidatePath(`/dashboard/campaigns/${existing.id}`);
  revalidatePath(`/campaigns/${existing.slug}`);
  redirect(`/dashboard/campaigns/${existing.id}?updated=1`);
}

/** DRAFT (or admin-REJECTED, after edits) → PENDING_REVIEW. Owner-scoped. */
export async function submitCampaignAction(campaignId: string): Promise<ActionResult> {
  const { user, owner } = await requireVerifiedOwner();

  // updateMany with the owner in the WHERE clause — never trust the id alone.
  const updated = await db.campaign.updateMany({
    where: {
      id: campaignId,
      ownerId: owner.id,
      status: { in: ["DRAFT", "REJECTED"] },
    },
    data: { status: "PENDING_REVIEW" },
  });
  if (updated.count === 0) {
    return { ok: false, error: "Campaign not found or not submittable." };
  }

  await writeAudit({
    actorId: user.id,
    action: "CAMPAIGN_SUBMITTED_FOR_REVIEW",
    entityType: "Campaign",
    entityId: campaignId,
  });

  revalidatePath("/dashboard/campaigns");
  return { ok: true };
}

const updateSchema = z.object({
  campaignId: z.string().min(1),
  title: z.string().trim().min(3, "Give the update a short title").max(120),
  body: z.string().trim().min(5, "Add a little more detail").max(5000),
});

/**
 * Post a progress update to one of the owner's own campaigns. Ownership is
 * enforced in the WHERE clause; updates are only allowed on live campaigns
 * (ACTIVE/COMPLETED) so drafts under review can't publish content to donors.
 */
export async function postCampaignUpdateAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { user, owner } = await requireVerifiedOwner();

  const parsed = updateSchema.safeParse({
    campaignId: formData.get("campaignId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const campaign = await db.campaign.findFirst({
    where: {
      id: parsed.data.campaignId,
      ownerId: owner.id,
      status: { in: ["ACTIVE", "COMPLETED"] },
    },
    select: { id: true, slug: true },
  });
  if (!campaign) {
    return {
      ok: false,
      error: "Updates can only be posted to your own live campaigns.",
    };
  }

  await db.campaignUpdate.create({
    data: {
      campaignId: campaign.id,
      title: parsed.data.title,
      body: parsed.data.body,
    },
  });
  await writeAudit({
    actorId: user.id,
    action: "CAMPAIGN_UPDATE_POSTED",
    entityType: "Campaign",
    entityId: campaign.id,
  });

  revalidatePath(`/dashboard/campaigns/${campaign.id}`);
  revalidatePath(`/campaigns/${campaign.slug}`);
  revalidatePath(`/campaigns/${campaign.slug}/updates`);
  return { ok: true };
}

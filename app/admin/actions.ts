"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { reviewDecisionSchema } from "@/lib/validators/campaign";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Every admin action re-verifies the role server-side. Never trust the UI. */
async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");
  return session.user.id;
}

/**
 * Allowed campaign status transitions for admin decisions. Encoded once so a
 * stray form post can't, say, resurrect an archived campaign to ACTIVE.
 */
const TRANSITIONS: Record<string, { from: CampaignStatus[]; to: CampaignStatus }> = {
  approve: { from: ["PENDING_REVIEW", "SUSPENDED"], to: "ACTIVE" },
  reject: { from: ["PENDING_REVIEW"], to: "REJECTED" },
  suspend: { from: ["ACTIVE"], to: "SUSPENDED" },
  complete: { from: ["ACTIVE"], to: "COMPLETED" },
  archive: { from: ["COMPLETED", "REJECTED", "SUSPENDED"], to: "ARCHIVED" },
};

export async function decideCampaignAction(
  decision: "approve" | "reject" | "suspend" | "complete" | "archive",
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const adminId = await requireAdmin();

  const parsed = reviewDecisionSchema.safeParse({
    campaignId: formData.get("campaignId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid review input" };

  const rule = TRANSITIONS[decision];
  const note = parsed.data.note || null;

  // Rejections must explain themselves — owners need to know what to fix.
  if (decision === "reject" && !note) {
    return { ok: false, error: "A note is required when rejecting a campaign." };
  }

  const updated = await db.campaign.updateMany({
    where: { id: parsed.data.campaignId, status: { in: rule.from } },
    data: {
      status: rule.to,
      reviewedAt: new Date(),
      ...(note ? { reviewNote: note } : {}),
    },
  });
  if (updated.count === 0) {
    return {
      ok: false,
      error: "Campaign not found or not in a state that allows this decision.",
    };
  }

  await writeAudit({
    actorId: adminId,
    action: `CAMPAIGN_${decision.toUpperCase()}`,
    entityType: "Campaign",
    entityId: parsed.data.campaignId,
    detail: note ? { note } : undefined,
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${parsed.data.campaignId}`);
  return { ok: true };
}

// ── Owner KYC decisions ──────────────────────────────────────────

import { generateUniqueAuthorCode } from "@/lib/querycode";
import { z } from "zod";

const ownerDecisionSchema = z.object({
  ownerId: z.string().min(1),
  note: z.string().trim().max(1_000).optional().or(z.literal("")),
});

/**
 * Decide an owner's KYC application (user.verificationStatus must be PENDING).
 *
 * approve  → user VERIFIED; owner gets the Mulesoo seal, a public author code,
 *            verifiedAt, biometric VERIFIED; pending documents APPROVED.
 * reject   → user REJECTED; pending documents REJECTED.
 * resubmit → user RESUBMIT (the wizard reopens); pending documents RESUBMIT.
 */
export async function decideOwnerAction(
  decision: "approve" | "reject" | "resubmit",
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const adminId = await requireAdmin();

  const parsed = ownerDecisionSchema.safeParse({
    ownerId: formData.get("ownerId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const note = parsed.data.note || null;

  if (decision !== "approve" && !note) {
    return {
      ok: false,
      error: "A note is required — the owner needs to know what to fix.",
    };
  }

  const owner = await db.campaignOwner.findUnique({
    where: { id: parsed.data.ownerId },
    select: {
      id: true,
      userId: true,
      authorCode: true,
      user: { select: { verificationStatus: true } },
    },
  });
  if (!owner) return { ok: false, error: "Owner not found" };
  if (owner.user.verificationStatus !== "PENDING") {
    return { ok: false, error: "This application is not awaiting review." };
  }

  if (decision === "approve") {
    const authorCode = owner.authorCode ?? (await generateUniqueAuthorCode());
    await db.$transaction([
      db.user.update({
        where: { id: owner.userId },
        data: { verificationStatus: "VERIFIED" },
      }),
      db.campaignOwner.update({
        where: { id: owner.id },
        data: {
          mulesooVerified: true,
          authorCode,
          verifiedAt: new Date(),
          biometricStatus: "VERIFIED",
        },
      }),
      db.verificationDocument.updateMany({
        where: { ownerId: owner.id, status: "PENDING" },
        data: { status: "APPROVED", ...(note ? { adminNote: note } : {}) },
      }),
    ]);
  } else {
    const userStatus = decision === "reject" ? "REJECTED" : "RESUBMIT";
    const docStatus = decision === "reject" ? "REJECTED" : "RESUBMIT";
    await db.$transaction([
      db.user.update({
        where: { id: owner.userId },
        data: { verificationStatus: userStatus },
      }),
      db.campaignOwner.update({
        where: { id: owner.id },
        data: { biometricStatus: docStatus },
      }),
      db.verificationDocument.updateMany({
        where: { ownerId: owner.id, status: "PENDING" },
        data: { status: docStatus, adminNote: note },
      }),
    ]);
  }

  await writeAudit({
    actorId: adminId,
    action: `OWNER_KYC_${decision.toUpperCase()}`,
    entityType: "CampaignOwner",
    entityId: owner.id,
    detail: note ? { note } : undefined,
  });

  revalidatePath("/admin/owners");
  revalidatePath(`/admin/owners/${owner.id}`);
  return { ok: true };
}

// ── Payout decisions ─────────────────────────────────────────────

const payoutDecisionSchema = z.object({
  payoutId: z.string().min(1),
  note: z.string().trim().max(1_000).optional().or(z.literal("")),
  payoutReference: z.string().trim().max(120).optional().or(z.literal("")),
});

/**
 * Payout lifecycle (admin side): REQUESTED → APPROVED → PAID, or
 * REQUESTED → REJECTED. Marking PAID demands the external payment reference
 * so every released birr traces to a real transfer.
 */
export async function decidePayoutAction(
  decision: "approve" | "reject" | "paid",
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const adminId = await requireAdmin();

  const parsed = payoutDecisionSchema.safeParse({
    payoutId: formData.get("payoutId"),
    note: formData.get("note") ?? "",
    payoutReference: formData.get("payoutReference") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const note = parsed.data.note || null;

  if (decision === "reject" && !note) {
    return { ok: false, error: "A note is required when rejecting a payout." };
  }
  if (decision === "paid" && !parsed.data.payoutReference) {
    return {
      ok: false,
      error: "Enter the transfer reference before marking a payout paid.",
    };
  }

  const where =
    decision === "paid"
      ? { id: parsed.data.payoutId, status: "APPROVED" as const }
      : { id: parsed.data.payoutId, status: "REQUESTED" as const };

  const data =
    decision === "approve"
      ? {
          status: "APPROVED" as const,
          approvedByAdminId: adminId,
          approvedAt: new Date(),
          ...(note ? { note } : {}),
        }
      : decision === "reject"
        ? { status: "REJECTED" as const, note }
        : {
            status: "PAID" as const,
            paidAt: new Date(),
            payoutReference: parsed.data.payoutReference,
            ...(note ? { note } : {}),
          };

  const updated = await db.payout.updateMany({ where, data });
  if (updated.count === 0) {
    return {
      ok: false,
      error: "Payout not found or not in a state that allows this decision.",
    };
  }

  await writeAudit({
    actorId: adminId,
    action: `PAYOUT_${decision.toUpperCase()}`,
    entityType: "Payout",
    entityId: parsed.data.payoutId,
    detail: {
      ...(note ? { note } : {}),
      ...(parsed.data.payoutReference ? { payoutReference: parsed.data.payoutReference } : {}),
    },
  });

  revalidatePath("/admin/payouts");
  return { ok: true };
}

/** Toggle the home-page "featured" flag. ACTIVE campaigns only. */
export async function toggleFeaturedAction(campaignId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { isFeatured: true, status: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found" };
  if (campaign.status !== "ACTIVE" && campaign.isFeatured === false) {
    return { ok: false, error: "Only active campaigns can be featured." };
  }

  await db.campaign.update({
    where: { id: campaignId },
    data: { isFeatured: !campaign.isFeatured },
  });
  await writeAudit({
    actorId: adminId,
    action: campaign.isFeatured ? "CAMPAIGN_UNFEATURED" : "CAMPAIGN_FEATURED",
    entityType: "Campaign",
    entityId: campaignId,
  });

  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  return { ok: true };
}

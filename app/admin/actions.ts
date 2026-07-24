"use server";

import { revalidatePath } from "next/cache";
import type { CampaignStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { reviewDecisionSchema } from "@/lib/validators/campaign";
import { requirePermission } from "@/lib/admin/permissions";
import { sendEmail, emailConfigured } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { signedKycUrl, uploadMediaFile } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

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
  const { id: adminId } = await requirePermission("campaigns");

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
  decision: "approve" | "reject" | "resubmit" | "revoke",
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { id: adminId } = await requirePermission("kyc");

  const parsed = ownerDecisionSchema.safeParse({
    ownerId: formData.get("ownerId"),
    note: formData.get("note") ?? "",
  });
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const note = parsed.data.note || null;

  if (decision !== "approve" && !note) {
    return {
      ok: false,
      error: "A note is required — the owner needs to know why.",
    };
  }

  const owner = await db.campaignOwner.findUnique({
    where: { id: parsed.data.ownerId },
    select: {
      id: true,
      userId: true,
      authorCode: true,
      idPhotoUrl: true,
      user: { select: { verificationStatus: true, role: true, name: true, email: true } },
    },
  });
  if (!owner) return { ok: false, error: "Owner not found" };

  // Which decisions are valid from the current status. Approve is allowed from
  // any not-yet-verified state; revoke only from a verified one.
  const status = owner.user.verificationStatus;
  const allowed: Record<typeof decision, string[]> = {
    approve: ["PENDING", "UNVERIFIED", "RESUBMIT", "REJECTED"],
    reject: ["PENDING", "UNVERIFIED", "RESUBMIT"],
    resubmit: ["PENDING", "UNVERIFIED", "REJECTED"],
    revoke: ["VERIFIED"],
  };
  if (!allowed[decision].includes(status)) {
    return { ok: false, error: `Cannot ${decision} an owner whose status is ${status}.` };
  }

  if (decision === "approve") {
    const authorCode = owner.authorCode ?? (await generateUniqueAuthorCode());

    // Anti-fraud: the ID portrait is the VERIFIED face, not a re-uploadable
    // gallery photo. On first approval, copy the biometric selfie into the
    // public bucket and lock it as the ID photo. Best-effort — never blocks
    // approval, and never overwrites an existing photo.
    let verifiedPhotoUrl: string | undefined;
    if (!owner.idPhotoUrl) {
      try {
        const selfie = await db.verificationDocument.findFirst({
          where: { ownerId: owner.id, documentType: "SELFIE" },
          orderBy: { createdAt: "desc" },
          select: { fileUrl: true },
        });
        const signed = selfie ? await signedKycUrl(selfie.fileUrl, 120) : null;
        if (signed) {
          const resp = await fetch(signed);
          if (resp.ok) {
            const buf = new Uint8Array(await resp.arrayBuffer());
            const up = await uploadMediaFile(
              `owners/${owner.id}/verified-id-${Date.now()}.jpg`,
              buf,
              "image/jpeg"
            );
            if (up.ok) verifiedPhotoUrl = up.url;
          }
        }
      } catch (err) {
        console.error("[kyc] selfie → ID photo copy failed:", err);
      }
    }

    await db.$transaction([
      db.user.update({
        where: { id: owner.userId },
        // Promote to OWNER on approval so the role is meaningful everywhere
        // (login routing, header, access). Never demote an admin.
        data: {
          verificationStatus: "VERIFIED",
          ...(owner.user.role === "ADMIN" ? {} : { role: "OWNER" }),
        },
      }),
      db.campaignOwner.update({
        where: { id: owner.id },
        data: {
          mulesooVerified: true,
          authorCode,
          verifiedAt: new Date(),
          biometricStatus: "VERIFIED",
          ...(verifiedPhotoUrl ? { idPhotoUrl: verifiedPhotoUrl } : {}),
        },
      }),
      db.verificationDocument.updateMany({
        where: { ownerId: owner.id, status: { in: ["PENDING", "RESUBMIT"] } },
        data: { status: "APPROVED", ...(note ? { adminNote: note } : {}) },
      }),
    ]);

    // Email the fundraiser a direct link to download their new ID (PDF + photo).
    // FULLY best-effort — approval must never fail if email OR the app URL env
    // is missing/misconfigured (this whole block used to be able to throw after
    // the DB commit, leaving the admin's button spinning with no result).
    try {
      if (emailConfigured() && owner.user.email) {
        const idUrl = `${appUrl()}/dashboard/id`;
        await sendEmail({
          to: owner.user.email,
          subject: "You're verified — download your Yewogen Derash Fundraiser ID",
          text:
            `Hello ${owner.user.name},\n\n` +
            `Your verification is approved. You now hold the Mulesoo trust seal and your ` +
            `Fundraiser ID (${authorCode}) is ready.\n\n` +
            `Download it (image or PDF) here: ${idUrl}\n\n` +
            `Sign in with your fundraiser code ${authorCode} and password, then open “My Fundraiser ID”.\n\n` +
            `— Yewogen Derash`,
          html:
            `<div style="font-family:system-ui,Arial,sans-serif;line-height:1.6">` +
            `<p>Hello ${owner.user.name},</p>` +
            `<p>Your verification is <strong>approved</strong> — you now hold the Mulesoo trust seal and your ` +
            `Fundraiser ID (<strong>${authorCode}</strong>) is ready.</p>` +
            `<p><a href="${idUrl}" style="display:inline-block;background:#0f7a4d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Download my Fundraiser ID</a></p>` +
            `<p style="color:#555">It’s available as a high-resolution image and a print-ready PDF. Sign in with your fundraiser code and password, then open “My Fundraiser ID”.</p>` +
            `<p style="color:#555">— Yewogen Derash</p></div>`,
        });
      }
    } catch (err) {
      console.error("[kyc] ID email failed (approval still succeeded):", err);
    }
  } else if (decision === "revoke") {
    // Pull the Mulesoo seal from a verified owner — re-locks their ID.
    await db.$transaction([
      db.user.update({
        where: { id: owner.userId },
        data: { verificationStatus: "REJECTED" },
      }),
      db.campaignOwner.update({
        where: { id: owner.id },
        data: { mulesooVerified: false, biometricStatus: "REJECTED" },
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
  const { id: adminId } = await requirePermission("payouts");

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
  const { id: adminId } = await requirePermission("campaigns");

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

/** Raise or clear a fraud flag on a campaign (brief §13). Audited. */
export async function setCampaignFlagAction(
  campaignId: string,
  flagged: boolean,
  reason?: string
): Promise<ActionResult> {
  const { id: adminId } = await requirePermission("campaigns");
  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  await db.campaign.update({
    where: { id: campaignId },
    data: { flagged, flagReason: flagged ? (reason?.trim() || "Flagged for review") : null },
  });
  await writeAudit({
    actorId: adminId,
    action: flagged ? "CAMPAIGN_FLAGGED" : "CAMPAIGN_UNFLAGGED",
    entityType: "Campaign",
    entityId: campaignId,
    detail: flagged ? { reason } : undefined,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/campaigns/${campaignId}`);
  return { ok: true };
}

/** Raise or clear a fraud flag on an owner. Audited. */
export async function setOwnerFlagAction(
  ownerId: string,
  flagged: boolean,
  reason?: string
): Promise<ActionResult> {
  const { id: adminId } = await requirePermission("kyc");
  const owner = await db.campaignOwner.findUnique({
    where: { id: ownerId },
    select: { id: true },
  });
  if (!owner) return { ok: false, error: "Owner not found." };

  await db.campaignOwner.update({
    where: { id: ownerId },
    data: { flagged, flagReason: flagged ? (reason?.trim() || "Flagged for review") : null },
  });
  await writeAudit({
    actorId: adminId,
    action: flagged ? "OWNER_FLAGGED" : "OWNER_UNFLAGGED",
    entityType: "CampaignOwner",
    entityId: ownerId,
    detail: flagged ? { reason } : undefined,
  });

  revalidatePath("/admin");
  revalidatePath(`/admin/owners/${ownerId}`);
  return { ok: true };
}

/**
 * Permanently delete a campaign and everything hanging off it — for spam,
 * duplicates, test entries, or a fraudulent campaign an admin wants gone rather
 * than merely hidden. This is irreversible.
 *
 * Financial integrity guard: a campaign that has actually taken money (any
 * SUCCESS donation or non-requested payout) is NOT hard-deleted. Wiping those
 * rows would destroy donor receipts and the money trail. Such a campaign must
 * be Archived instead (hidden, records intact). Everything else — drafts,
 * pending, rejected, suspended, or active-but-unfunded — can be removed
 * completely at any time.
 *
 * Child rows that use ON DELETE RESTRICT (donations, payouts, fee ledgers,
 * notifications) are cleared explicitly inside one transaction; documents,
 * updates, and the balance row fall away via ON DELETE CASCADE.
 */
export async function deleteCampaignAction(
  campaignId: string
): Promise<ActionResult> {
  const { id: adminId } = await requirePermission("campaigns");

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: {
      id: true,
      title: true,
      slug: true,
      queryCode: true,
      ownerId: true,
      currentAmount: true,
      _count: {
        select: {
          donations: { where: { status: "SUCCESS" } },
          payouts: { where: { status: { not: "REQUESTED" } } },
        },
      },
    },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  if (campaign._count.donations > 0 || campaign._count.payouts > 0) {
    return {
      ok: false,
      error:
        "This campaign has received money, so it can't be deleted — that would " +
        "erase donor receipts and the payout trail. Archive it instead to hide " +
        "it while keeping the records.",
    };
  }

  // Record what is about to vanish BEFORE it does, so the audit log keeps a
  // permanent trace of the deletion even though the campaign itself is gone.
  await writeAudit({
    actorId: adminId,
    action: "CAMPAIGN_DELETED",
    entityType: "Campaign",
    entityId: campaign.id,
    detail: {
      title: campaign.title,
      queryCode: campaign.queryCode,
      slug: campaign.slug,
      ownerId: campaign.ownerId,
      currentAmount: Number(campaign.currentAmount),
    },
  });

  await db.$transaction([
    // RESTRICT relations must go first (only non-money rows can exist here).
    db.feeLedger.deleteMany({ where: { campaignId } }),
    db.notification.deleteMany({ where: { campaignId } }),
    db.payout.deleteMany({ where: { campaignId } }),
    db.donation.deleteMany({ where: { campaignId } }),
    // Campaign itself — documents, updates, and balance cascade away.
    db.campaign.delete({ where: { id: campaignId } }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/campaigns");
  revalidatePath("/campaigns");
  return { ok: true };
}

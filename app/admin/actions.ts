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

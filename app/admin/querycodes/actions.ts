"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { generateUniqueQueryCode } from "@/lib/querycode";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: true; code?: string } | { ok: false; error: string };

/**
 * Issue a fresh querycode for a campaign, retiring the old one. The public
 * /q/<old> link and its QR stop resolving immediately — used when a code leaks
 * or a printed poster must be invalidated. One campaign still has exactly one
 * code afterwards.
 */
export async function regenerateQueryCodeAction(campaignId: string): Promise<ActionResult> {
  const admin = await requirePermission("campaigns");

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, queryCode: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  const newCode = await generateUniqueQueryCode();
  await db.campaign.update({
    where: { id: campaignId },
    data: { queryCode: newCode },
  });

  await writeAudit({
    actorId: admin.id,
    action: "QUERYCODE_REGENERATED",
    entityType: "Campaign",
    entityId: campaignId,
    detail: { from: campaign.queryCode, to: newCode },
  });

  revalidatePath("/admin/querycodes");
  return { ok: true, code: newCode };
}

/** Enable or disable a campaign's querycode without changing the campaign. */
export async function setQueryCodeActiveAction(
  campaignId: string,
  active: boolean
): Promise<ActionResult> {
  const admin = await requirePermission("campaigns");

  const campaign = await db.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, queryCode: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };

  await db.campaign.update({
    where: { id: campaignId },
    data: { queryCodeActive: active },
  });

  await writeAudit({
    actorId: admin.id,
    action: active ? "QUERYCODE_ENABLED" : "QUERYCODE_DISABLED",
    entityType: "Campaign",
    entityId: campaignId,
    detail: { queryCode: campaign.queryCode },
  });

  revalidatePath("/admin/querycodes");
  return { ok: true };
}

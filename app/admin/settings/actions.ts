"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireSuperAdmin } from "@/lib/admin/permissions";
import { getPlatformSettings, updatePlatformSettings } from "@/lib/settings";
import { writeAudit } from "@/lib/audit";

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string };

const schema = z.object({
  // Entered as a percentage in the UI (e.g. 3 = 3%); stored as a 0–1 rate.
  feePercent: z.coerce
    .number()
    .min(0, "Fee cannot be negative")
    .max(30, "Fee looks too high (max 30%)"),
  autoApproveMaxEtb: z.coerce
    .number()
    .int("Whole birr only")
    .min(0, "Cannot be negative")
    .max(10_000_000, "That ceiling is unrealistically high"),
});

export async function updatePlatformSettingsAction(
  _prev: SettingsResult | null,
  formData: FormData
): Promise<SettingsResult> {
  const admin = await requireSuperAdmin();

  const parsed = schema.safeParse({
    feePercent: formData.get("feePercent"),
    autoApproveMaxEtb: formData.get("autoApproveMaxEtb"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the values" };
  }

  const before = await getPlatformSettings();
  const feeRate = Math.round(parsed.data.feePercent * 1000) / 100000; // % → rate, 5dp
  const autoApproveMaxEtb = parsed.data.autoApproveMaxEtb;

  await updatePlatformSettings({ feeRate, autoApproveMaxEtb, updatedById: admin.id });

  await writeAudit({
    actorId: admin.id,
    action: "PLATFORM_SETTINGS_UPDATED",
    entityType: "PlatformSettings",
    entityId: "singleton",
    detail: {
      feeRate: { from: before.feeRate, to: feeRate },
      autoApproveMaxEtb: { from: before.autoApproveMaxEtb, to: autoApproveMaxEtb },
    },
  });

  revalidatePath("/admin/settings");
  return { ok: true };
}

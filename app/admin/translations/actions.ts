"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";
import { I18N_OVERRIDES_KEY, type I18nOverrides } from "@/lib/i18n";
import { AM_FLAT, EN_FLAT } from "@/lib/i18n-data";

export type SaveResult = { ok: true; count: number } | { ok: false; error: string };

/**
 * Save translation edits. Fields are named `am.<path>` / `en.<path>`. Only
 * values that differ from the built-in default are stored as overrides (so the
 * override blob stays small and defaults keep flowing through for untouched
 * strings). Super-admin only; audited.
 */
export async function saveTranslationsAction(
  _prev: SaveResult | null,
  formData: FormData
): Promise<SaveResult> {
  const admin = await requireSuperAdmin();

  const am: Record<string, string> = {};
  const en: Record<string, string> = {};
  for (const [field, raw] of formData.entries()) {
    if (typeof raw !== "string") continue;
    const value = raw.trim();
    if (field.startsWith("am.")) {
      const path = field.slice(3);
      if (path in AM_FLAT && value && value !== AM_FLAT[path]) am[path] = value;
    } else if (field.startsWith("en.")) {
      const path = field.slice(3);
      if (path in EN_FLAT && value && value !== EN_FLAT[path]) en[path] = value;
    }
  }

  const overrides: I18nOverrides = {};
  if (Object.keys(am).length) overrides.am = am;
  if (Object.keys(en).length) overrides.en = en;

  await db.siteContent.upsert({
    where: { key: I18N_OVERRIDES_KEY },
    create: { key: I18N_OVERRIDES_KEY, value: overrides as Prisma.InputJsonValue, updatedBy: admin.id },
    update: { value: overrides as Prisma.InputJsonValue, updatedBy: admin.id },
  });

  await writeAudit({
    actorId: admin.id,
    action: "TRANSLATIONS_UPDATED",
    entityType: "SiteContent",
    entityId: I18N_OVERRIDES_KEY,
    detail: { amCount: Object.keys(am).length, enCount: Object.keys(en).length },
  });

  // Overrides affect every page — revalidate broadly.
  revalidatePath("/", "layout");
  return { ok: true, count: Object.keys(am).length + Object.keys(en).length };
}

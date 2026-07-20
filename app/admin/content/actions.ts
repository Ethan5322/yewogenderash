"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { CONTENT_REGISTRY, isContentKey } from "@/lib/content";
import { requirePermission } from "@/lib/admin/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Save an admin-edited content block. The submitted JSON is parsed and then
 * validated against the key's registered schema — a bad payload can never land
 * in the DB, so public pages that read it stay safe.
 */
export async function saveContentAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const { id: adminId } = await requirePermission("content");

  const key = String(formData.get("key") ?? "");
  if (!isContentKey(key)) return { ok: false, error: "Unknown content key." };

  const raw = String(formData.get("value") ?? "");
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "Invalid JSON — check for a trailing comma or missing quote." };
  }

  const parsed = CONTENT_REGISTRY[key].schema.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path.length ? ` at ${first.path.join(".")}` : "";
    return { ok: false, error: `Content doesn't match the expected shape${where}: ${first?.message ?? "invalid"}` };
  }

  await db.siteContent.upsert({
    where: { key },
    create: { key, value: parsed.data, updatedBy: adminId },
    update: { value: parsed.data, updatedBy: adminId },
  });

  await writeAudit({
    actorId: adminId,
    action: "SITE_CONTENT_UPDATE",
    entityType: "SiteContent",
    entityId: key,
  });

  // Revalidate the public surfaces that read this key.
  if (key === "support.faq") revalidatePath("/support/faq");
  if (key === "site.announcement") revalidatePath("/", "layout");
  revalidatePath(`/admin/content/${key}`);

  return { ok: true };
}

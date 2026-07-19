"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { whatsappPrefsSchema } from "@/lib/validators/onboarding";

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function saveWhatsappPrefsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/settings");

  const parsed = whatsappPrefsSchema.safeParse({
    whatsappAlerts: formData.get("whatsappAlerts") === "on",
    whatsappPhone: formData.get("whatsappPhone") ?? "",
    callmebotApiKey: formData.get("callmebotApiKey") ?? "",
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the form" };
  }

  if (
    parsed.data.whatsappAlerts &&
    (!parsed.data.whatsappPhone || !parsed.data.callmebotApiKey)
  ) {
    return {
      ok: false,
      error: "To receive alerts, add both your WhatsApp number and CallMeBot API key.",
    };
  }

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!owner) {
    return { ok: false, error: "Complete owner verification first." };
  }

  await db.campaignOwner.update({
    where: { id: owner.id },
    data: {
      whatsappAlerts: parsed.data.whatsappAlerts,
      whatsappPhone: parsed.data.whatsappPhone?.replace(/[\s-]/g, "") || null,
      callmebotApiKey: parsed.data.callmebotApiKey || null,
    },
  });

  await writeAudit({
    actorId: session.user.id,
    action: "OWNER_WHATSAPP_PREFS_UPDATED",
    entityType: "CampaignOwner",
    entityId: owner.id,
    detail: { alerts: parsed.data.whatsappAlerts },
  });

  revalidatePath("/dashboard/settings");
  return { ok: true };
}

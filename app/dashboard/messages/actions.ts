"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";

export type ActionResult = { ok: true } | { ok: false; error: string };

const schema = z.object({
  body: z.string().trim().min(2, "Write a message").max(4000, "Message is too long"),
});

/** A fundraiser sends a message to the admin team (their own thread). */
export async function sendOwnerMessageAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/messages");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!owner) redirect("/start");

  const parsed = schema.safeParse({ body: formData.get("body") });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check your message" };
  }

  await db.message.create({
    data: {
      ownerId: owner.id,
      senderUserId: session.user.id,
      fromAdmin: false,
      body: parsed.data.body,
      readByOwner: true, // the sender has obviously seen it
      readByAdmin: false,
    },
  });

  revalidatePath("/dashboard/messages");
  return { ok: true };
}

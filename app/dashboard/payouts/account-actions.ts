"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createChapaSubaccount } from "@/lib/chapa";
import { PLATFORM_FEE_RATE } from "@/lib/fees";

export type ActionResult = { ok: true } | { ok: false; error: string };

const accountSchema = z.object({
  accountName: z.string().trim().min(2, "Account name is required").max(120),
  bankCode: z.string().trim().min(1, "Select a bank"),
  bankName: z.string().trim().min(1).max(120),
  accountNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{6,20}$/, "Account number must be 6–20 digits"),
});

/**
 * Add (or replace) the fundraiser's verified payout account. Creating the
 * account registers a Chapa subaccount so future donations to this owner's
 * campaigns split 3% to the platform and settle the rest to this bank
 * automatically. The new account becomes the single active default.
 *
 * The fee rate is fixed server-side — the owner cannot influence it.
 */
export async function savePayoutAccountAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/payouts");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { id: true, userId: true, user: { select: { name: true } } },
  });
  if (!owner) redirect("/start");

  const parsed = accountSchema.safeParse({
    accountName: formData.get("accountName"),
    bankCode: formData.get("bankCode"),
    bankName: formData.get("bankName"),
    accountNumber: formData.get("accountNumber"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the details" };
  }
  const data = parsed.data;

  // Register the split target with Chapa.
  const sub = await createChapaSubaccount({
    businessName: `Yewogen Derash — ${owner.user.name}`,
    bankCode: data.bankCode,
    accountNumber: data.accountNumber,
    accountName: data.accountName,
    splitValue: PLATFORM_FEE_RATE,
  });
  if (!sub.ok) {
    return { ok: false, error: `Bank could not be verified with the payment provider: ${sub.error}` };
  }

  // One active account per owner: demote the rest, then upsert this one.
  await db.$transaction(async (tx) => {
    await tx.payoutAccount.updateMany({
      where: { ownerId: owner.id, isDefault: true },
      data: { isDefault: false },
    });
    await tx.payoutAccount.create({
      data: {
        ownerId: owner.id,
        accountName: data.accountName,
        bankName: data.bankName,
        bankCode: data.bankCode,
        accountNumber: data.accountNumber,
        chapaSubaccountId: sub.subaccountId,
        isVerified: true,
        verifiedAt: new Date(),
        isDefault: true,
      },
    });
  });

  await writeAudit({
    actorId: owner.userId,
    action: "PAYOUT_ACCOUNT_ADDED",
    entityType: "PayoutAccount",
    entityId: owner.id,
    detail: { bankName: data.bankName, last4: data.accountNumber.slice(-4) },
  });

  revalidatePath("/dashboard/payouts");
  return { ok: true };
}

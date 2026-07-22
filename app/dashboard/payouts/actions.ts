"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  campaignAvailableBalance,
  evaluateWithdrawalApproval,
} from "@/lib/payouts";
import { getPlatformSettings } from "@/lib/settings";

export type ActionResult = { ok: true } | { ok: false; error: string };

const requestSchema = z.object({
  campaignId: z.string().min(1),
  amount: z.coerce.number().int("Whole birr only").min(1, "Enter a valid amount"),
});

async function requireOwner() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/payouts");
  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      userId: true,
      mulesooVerified: true,
      payoutAccounts: {
        where: { isDefault: true, isVerified: true },
        take: 1,
        select: { id: true },
      },
    },
  });
  if (!owner) redirect("/start");
  return owner;
}

/**
 * Owner requests a payout from one campaign's separated ledger. Funds are
 * reserved at request time; release requires explicit admin approval and a
 * recorded payment — owners can never self-release (brief §13.2).
 */
export async function requestPayoutAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const owner = await requireOwner();

  const parsed = requestSchema.safeParse({
    campaignId: formData.get("campaignId"),
    amount: formData.get("amount"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Check the amount" };
  }
  const { minPayoutEtb } = await getPlatformSettings();
  if (parsed.data.amount < minPayoutEtb) {
    return { ok: false, error: `Minimum payout is ETB ${minPayoutEtb.toLocaleString()}.` };
  }
  const account = owner.payoutAccounts[0];
  if (!account) {
    return {
      ok: false,
      error: "Add and verify a payout bank account before requesting a payout.",
    };
  }

  // The campaign must belong to this owner.
  const campaign = await db.campaign.findFirst({
    where: { id: parsed.data.campaignId, ownerId: owner.id },
    select: { id: true, currency: true, status: true },
  });
  if (!campaign) return { ok: false, error: "Campaign not found." };
  if (campaign.status !== "ACTIVE" && campaign.status !== "COMPLETED") {
    return { ok: false, error: "Payouts are available for active or completed campaigns." };
  }

  const available = await campaignAvailableBalance(campaign.id);
  if (parsed.data.amount > available) {
    return {
      ok: false,
      error: `Only ETB ${available.toLocaleString()} is available on this campaign.`,
    };
  }

  // Automated approval gate — conservative; most requests still reach a human.
  const decision = await evaluateWithdrawalApproval({
    ownerId: owner.id,
    mulesooVerified: owner.mulesooVerified,
    hasVerifiedAccount: true,
    amount: parsed.data.amount,
  });

  const payout = await db.payout.create({
    data: {
      campaignId: campaign.id,
      ownerId: owner.id,
      amount: parsed.data.amount,
      currency: campaign.currency,
      payoutAccountId: account.id,
      status: decision.autoApprove ? "APPROVED" : "REQUESTED",
      autoApproved: decision.autoApprove,
      reviewReason: decision.reason,
      approvedAt: decision.autoApprove ? new Date() : null,
    },
  });

  await writeAudit({
    actorId: owner.userId,
    action: decision.autoApprove ? "PAYOUT_AUTO_APPROVED" : "PAYOUT_REQUESTED",
    entityType: "Payout",
    entityId: payout.id,
    detail: {
      campaignId: campaign.id,
      amount: parsed.data.amount,
      autoApproved: decision.autoApprove,
      reason: decision.reason,
    },
  });

  revalidatePath("/dashboard/payouts");
  return { ok: true };
}

/** Owner may withdraw a payout request while it is still REQUESTED. */
export async function cancelPayoutAction(payoutId: string): Promise<ActionResult> {
  const owner = await requireOwner();

  const updated = await db.payout.updateMany({
    where: { id: payoutId, ownerId: owner.id, status: "REQUESTED" },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) {
    return { ok: false, error: "This request can no longer be cancelled." };
  }

  await writeAudit({
    actorId: owner.userId,
    action: "PAYOUT_CANCELLED_BY_OWNER",
    entityType: "Payout",
    entityId: payoutId,
  });

  revalidatePath("/dashboard/payouts");
  return { ok: true };
}

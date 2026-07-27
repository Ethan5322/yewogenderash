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
  quoteWithdrawal,
} from "@/lib/payouts";
import { getPlatformSettings } from "@/lib/settings";
import { formatETB } from "@/lib/format";
import { WITHHOLDING_FEE_RATE } from "@/lib/fees";

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
        select: {
          id: true,
          bankName: true,
          accountName: true,
          accountNumber: true,
        },
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
    select: { id: true, title: true, queryCode: true, currency: true, status: true },
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

  // Safety & guarantee withholding: 7% of the campaign's gross, charged once.
  // Quoted here from the server so the recorded figures are authoritative — the
  // breakdown shown on the form is only a preview.
  const quote = await quoteWithdrawal(campaign.id, parsed.data.amount);

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
      withholdingFee: quote.withholding,
      netPaidAmount: quote.net,
      payoutAccountId: account.id,
      status: decision.autoApprove ? "APPROVED" : "REQUESTED",
      autoApproved: decision.autoApprove,
      reviewReason: decision.reason,
      approvedAt: decision.autoApprove ? new Date() : null,
    },
  });

  // Automatic report to the admin team. This lands in the admin message queue,
  // which drives the unread badge and the alert feed, so a withdrawal request is
  // never something an admin has to go looking for.
  await db.message.create({
    data: {
      ownerId: owner.id,
      senderUserId: owner.userId,
      fromAdmin: false,
      subject: `Withdrawal request — ${formatETB(quote.requested, campaign.currency)}`,
      body: [
        `A withdrawal has been requested and is awaiting transfer.`,
        ``,
        `Campaign: ${campaign.title}`,
        `Querycode: ${campaign.queryCode}`,
        `Requested: ${formatETB(quote.requested, campaign.currency)}`,
        `Safety & guarantee withholding (${Math.round(WITHHOLDING_FEE_RATE * 100)}% of gross, charged once): ${formatETB(quote.withholding, campaign.currency)}`,
        `Amount to transfer: ${formatETB(quote.net, campaign.currency)}`,
        ``,
        `Payout account: ${account.bankName} · ${account.accountName} · ${account.accountNumber}`,
        ``,
        decision.autoApprove
          ? `Status: auto-approved (${decision.reason}) — awaiting transfer.`
          : `Status: awaiting admin approval (${decision.reason}).`,
      ].join("\n"),
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
      withholdingFee: quote.withholding,
      netPaidAmount: quote.net,
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

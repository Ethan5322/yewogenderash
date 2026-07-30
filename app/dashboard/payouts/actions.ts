"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import {
  campaignAvailableBalance,
  campaignWithholdingDue,
  campaignWithdrawEligibility,
  evaluateWithdrawalApproval,
  quoteWithdrawal,
} from "@/lib/payouts";
import { getPlatformSettings } from "@/lib/settings";
import { formatETB } from "@/lib/format";
import {
  WITHHOLDING_FEE_RATE,
  withdrawableMax,
  grossUpForWithholding,
} from "@/lib/fees";

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
 * Why a withdrawal is refused, in words a fundraiser can act on. Exported so
 * the payouts page shows the SAME sentence it would get on submit — a page that
 * says one thing and a form that says another is how support tickets start.
 */
export const WITHDRAW_BLOCKED_MESSAGE: Record<string, string> = {
  not_closed:
    "Your campaign is still collecting donations. Withdrawals open once the team closes it, so the amount paid out is final.",
  already_withdrawn:
    "This campaign has already been paid out. Each campaign is withdrawn once, in full.",
  in_progress:
    "A withdrawal for this campaign is already being processed. You will be notified when it is transferred.",
  nothing_available:
    "There is nothing available to withdraw on this campaign yet.",
};

/**
 * Owner requests the payout of one campaign's separated ledger.
 *
 * ONE withdrawal per campaign, for the whole balance, only after the campaign
 * has been closed — see campaignWithdrawEligibility for why each of those three
 * conditions is there. Funds are reserved at request time; release still
 * requires explicit admin approval and a recorded payment, so owners can never
 * self-release (brief §13.2).
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
  // Deliberately NOT ACTIVE any more. A campaign gets one withdrawal for its
  // whole balance, which is only a final figure once donations have stopped —
  // withdrawing "everything" from a live campaign would strand every birr that
  // arrived afterwards, unreachable by the fundraiser or anyone else.

  // The amount typed is what the fundraiser RECEIVES, so the ceiling is the
  // balance less the outstanding withholding — 90% of gross on a campaign that
  // has not withdrawn yet. Checked on the server because the form's `max` is a
  // convenience for people, not a control: anyone can post past it.
  const available = await campaignAvailableBalance(campaign.id);
  const { due } = await campaignWithholdingDue(campaign.id);
  const maxWithdrawable = withdrawableMax(available, due);

  const eligibility = await campaignWithdrawEligibility(
    campaign.id,
    campaign.status,
    maxWithdrawable
  );
  if (!eligibility.ok) {
    return { ok: false, error: WITHDRAW_BLOCKED_MESSAGE[eligibility.reason] };
  }

  // One withdrawal, all of it. The amount is not the fundraiser's to choose, so
  // it is not read from the form at all — a posted figure is only accepted if it
  // matches the balance the server computed. Anything else is a stale page or a
  // tampered request, and both deserve the same answer.
  if (parsed.data.amount !== maxWithdrawable) {
    return {
      ok: false,
      error:
        parsed.data.amount > maxWithdrawable
          ? `Insufficient funds — you can withdraw ETB ${maxWithdrawable.toLocaleString()}, which is your full balance.`
          : `Withdrawals are made in one payment of the full balance — ETB ${maxWithdrawable.toLocaleString()}. Refresh the page and try again.`,
    };
  }

  // Charge the balance for what they asked for PLUS the outstanding withholding,
  // so the figure they typed is the figure that reaches their bank. Quoted from
  // the server so the recorded numbers are authoritative — the breakdown on the
  // form is only a preview.
  const quote = await quoteWithdrawal(
    campaign.id,
    grossUpForWithholding(parsed.data.amount, due)
  );

  // The gross-up must land exactly, or the fundraiser is paid a different number
  // from the one they agreed to. Cheap to assert, and a silent rounding drift
  // here would be a money bug nobody notices until a fundraiser complains.
  if (quote.net !== parsed.data.amount) {
    console.error("payout gross-up mismatch", {
      campaignId: campaign.id,
      typed: parsed.data.amount,
      due,
      quote,
    });
    return { ok: false, error: "Could not price that withdrawal. Please contact support." };
  }

  // Automated approval gate — conservative; most requests still reach a human.
  // Judged on the grossed-up figure, the money actually leaving the ledger.
  const decision = await evaluateWithdrawalApproval({
    ownerId: owner.id,
    mulesooVerified: owner.mulesooVerified,
    hasVerifiedAccount: true,
    amount: quote.requested,
  });

  const payout = await db.payout.create({
    data: {
      campaignId: campaign.id,
      ownerId: owner.id,
      // `amount` is what this payout RESERVES against the campaign's balance —
      // campaignAvailableBalance subtracts exactly this field — so it must be
      // the grossed-up figure, not the net the fundraiser receives. Storing the
      // net here would leave the withholding portion looking withdrawable
      // forever, which on a one-withdrawal-per-campaign rule means a permanent
      // phantom balance nobody can ever claim.
      amount: quote.requested,
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

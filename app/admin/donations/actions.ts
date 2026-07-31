"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { writeAudit } from "@/lib/audit";

export type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Refund a successful donation (brief §12.4). Flips SUCCESS→REFUNDED and
 * reverses the campaign's raised total + balance in one transaction. Actual
 * money movement is performed in the Chapa dashboard/API; this records the
 * refund so ledgers and balances stay correct.
 */
export async function refundDonationAction(
  donationId: string,
  reason?: string
): Promise<ActionResult> {
  const admin = await requirePermission("payouts");
  const d = await db.donation.findUnique({
    where: { id: donationId },
    select: { id: true, status: true, amount: true, netAmount: true, platformFee: true, campaignId: true },
  });
  if (!d) return { ok: false, error: "Donation not found." };
  if (d.status !== "SUCCESS") return { ok: false, error: "Only successful donations can be refunded." };

  await db.$transaction(async (tx) => {
    const flipped = await tx.donation.updateMany({
      where: { id: d.id, status: "SUCCESS" },
      data: { status: "REFUNDED" },
    });
    if (flipped.count === 0) return;
    // Mirror of the credit in settleDonation: currentAmount holds NET, so a
    // refund takes back the net. Decrementing the gross here would quietly eat
    // the fee out of the campaign's total on every refund.
    await tx.campaign.update({
      where: { id: d.campaignId },
      data: { currentAmount: { decrement: d.netAmount ?? d.amount } },
    });
    // The balance denorm that used to be adjusted here is gone (migration 0022).
    // A refund takes effect automatically now: the donation is no longer SUCCESS,
    // so campaignAvailableBalance stops counting it. Nothing to keep in step.
  });

  await writeAudit({
    actorId: admin.id,
    action: "DONATION_REFUNDED",
    entityType: "Donation",
    entityId: d.id,
    detail: { reason, amount: Number(d.amount) },
  });
  revalidatePath("/admin/donations");
  return { ok: true };
}

/** Flag a donation as disputed/charged-back (pending resolution). Audited. */
export async function disputeDonationAction(
  donationId: string,
  reason?: string
): Promise<ActionResult> {
  const admin = await requirePermission("payouts");
  const d = await db.donation.findUnique({
    where: { id: donationId },
    select: { id: true, status: true },
  });
  if (!d) return { ok: false, error: "Donation not found." };
  if (d.status !== "SUCCESS" && d.status !== "REFUNDED") {
    return { ok: false, error: "Only settled donations can be disputed." };
  }

  await db.donation.update({ where: { id: d.id }, data: { status: "DISPUTED" } });
  await writeAudit({
    actorId: admin.id,
    action: "DONATION_DISPUTED",
    entityType: "Donation",
    entityId: d.id,
    detail: { reason },
  });
  revalidatePath("/admin/donations");
  return { ok: true };
}

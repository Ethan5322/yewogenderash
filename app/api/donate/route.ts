import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { appUrl } from "@/lib/env";
import { initializeChapaPayment } from "@/lib/chapa";
import { newTxRef, MIN_DONATION_ETB, MAX_DONATION_ETB } from "@/lib/donations";
import { rateLimit, ipKey, tooManyResponse } from "@/lib/rate-limit";

const donateSchema = z.object({
  queryCode: z.string().trim().min(4).max(16),
  amount: z.coerce
    .number()
    .int("Whole birr only")
    .min(MIN_DONATION_ETB, `Minimum donation is ETB ${MIN_DONATION_ETB}`)
    .max(MAX_DONATION_ETB, "Amount too large — contact support for major gifts"),
  email: z.email("A valid email is needed for your receipt").max(190),
  donorName: z.string().trim().max(100).optional().or(z.literal("")),
  anonymous: z.boolean().optional().default(false),
});

/**
 * Start a donation: create the PENDING ledger row, then hand the donor to
 * Chapa's hosted checkout. Success is decided ONLY by webhook/verify later —
 * this endpoint never touches campaign totals.
 */
export async function POST(req: Request) {
  // A single source shouldn't be able to open dozens of checkout sessions.
  const limit = rateLimit(ipKey(req, "donate"), 8, 5 * 60_000);
  if (!limit.ok) return tooManyResponse(limit);

  const parsed = donateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const input = parsed.data;

  // Donations land on exactly one campaign, resolved by its unique querycode.
  const campaign = await db.campaign.findUnique({
    where: { queryCode: input.queryCode },
    select: {
      id: true,
      title: true,
      status: true,
      currency: true,
      // The owner's active subaccount is the Chapa split target (their bank).
      owner: {
        select: {
          payoutAccounts: {
            where: { isDefault: true, isVerified: true, chapaSubaccountId: { not: null } },
            select: { chapaSubaccountId: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!campaign || campaign.status !== "ACTIVE") {
    return NextResponse.json(
      { error: "This campaign is not accepting donations." },
      { status: 404 }
    );
  }
  const subaccountId = campaign.owner?.payoutAccounts[0]?.chapaSubaccountId ?? undefined;

  const session = await auth();
  const txRef = newTxRef();
  const donorName = input.anonymous ? null : input.donorName || null;

  const donation = await db.donation.create({
    data: {
      campaignId: campaign.id,
      donorId: session?.user?.id ?? null,
      donorName,
      amount: input.amount,
      currency: campaign.currency,
      txRef,
      status: "PENDING",
    },
  });

  const init = await initializeChapaPayment({
    amount: input.amount,
    currency: campaign.currency,
    email: input.email,
    firstName: donorName ?? "Anonymous",
    txRef,
    returnUrl: `${appUrl()}/donate/thanks?tx_ref=${encodeURIComponent(txRef)}`,
    subaccountId,
  });

  if (!init.ok) {
    // Payment session never opened — close the ledger row immediately.
    await db.donation.update({
      where: { id: donation.id },
      data: { status: "CANCELLED" },
    });
    // Turn the gateway's most common rejection into a donor-friendly message.
    const friendly = /email/i.test(init.error)
      ? "The payment provider couldn't verify this email. Please use a real address like Gmail, Yahoo, or Outlook."
      : `Payment could not be started: ${init.error}`;
    return NextResponse.json({ error: friendly }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl: init.checkoutUrl, txRef });
}

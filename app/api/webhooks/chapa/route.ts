import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyChapaWebhookSignature } from "@/lib/chapa";
import { settleDonation } from "@/lib/donations";
import { deliverQueuedNotifications } from "@/lib/notifications";

/**
 * Chapa webhook receiver. Rules (brief §10.2):
 *   - verify the signature before anything else
 *   - store EVERY event (audit + idempotency; never delete)
 *   - ignore unknown or duplicate events
 *   - settlement re-verifies with the gateway before marking SUCCESS
 *
 * Always answers 200 for processed/ignored events so the gateway stops
 * retrying; only signature failures get 401.
 */
export async function POST(req: Request) {
  const rawBody = await req.text();

  const signatureOk = verifyChapaWebhookSignature(rawBody, req.headers);
  if (!signatureOk) {
    // Still record the attempt — forged or misconfigured, ops must see it.
    await db.webhookEvent
      .create({
        data: {
          provider: "chapa",
          externalRef: `invalid-sig-${Date.now()}`,
          payload: { raw: rawBody.slice(0, 4000) },
          signatureOk: false,
          outcome: "rejected_signature",
          processedAt: new Date(),
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const txRef =
    (typeof payload.tx_ref === "string" && payload.tx_ref) ||
    (typeof payload.trx_ref === "string" && payload.trx_ref) ||
    null;
  if (!txRef) {
    return NextResponse.json({ ok: true, ignored: "no tx_ref" });
  }

  // Store-once idempotency: the unique externalRef makes replays no-ops.
  let event;
  try {
    event = await db.webhookEvent.create({
      data: {
        provider: "chapa",
        externalRef: txRef,
        payload: payload as Prisma.InputJsonValue,
        signatureOk: true,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const existing = await db.webhookEvent.findUnique({
        where: { externalRef: txRef },
        select: { processedAt: true },
      });
      if (existing?.processedAt) {
        return NextResponse.json({ ok: true, ignored: "duplicate" });
      }
      event = await db.webhookEvent.findUniqueOrThrow({
        where: { externalRef: txRef },
      });
    } else {
      throw err;
    }
  }

  const result = await settleDonation(txRef);

  // Drain the owner-alert queue; a delivery failure must never fail the webhook.
  if (result.outcome === "success") {
    await deliverQueuedNotifications().catch(() => {});
  }

  await db.webhookEvent.update({
    where: { id: event.id },
    data: {
      processedAt: new Date(),
      outcome:
        "detail" in result ? `${result.outcome}: ${result.detail}` : result.outcome,
    },
  });

  return NextResponse.json({ ok: true, outcome: result.outcome });
}

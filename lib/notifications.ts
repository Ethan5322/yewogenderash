import "server-only";
import { db } from "@/lib/db";

/**
 * WhatsApp delivery via CallMeBot (brief §11). Each owner supplies their own
 * phone + CallMeBot API key and can switch alerts off; rows queue in the
 * Notification table (written inside the settlement transaction) and this
 * processor drains them. Every attempt's outcome is recorded.
 */

const CALLMEBOT_BASE = "https://api.callmebot.com/whatsapp.php";

export async function sendWhatsApp(
  phone: string,
  apiKey: string,
  text: string
): Promise<{ ok: boolean; error?: string }> {
  const url = `${CALLMEBOT_BASE}?phone=${encodeURIComponent(phone)}&apikey=${encodeURIComponent(apiKey)}&text=${encodeURIComponent(text)}`;
  try {
    const res = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    const body = await res.text();
    // CallMeBot answers 200 with a human-readable page; error strings appear
    // in the body rather than the status code.
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    if (/error|invalid|not registered/i.test(body)) {
      return { ok: false, error: body.slice(0, 300) };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network error" };
  }
}

/**
 * Drain up to `limit` queued notifications. Safe to call from anywhere
 * server-side (webhook, page fallback); each row is claimed with a guarded
 * update so concurrent drains never double-send.
 */
export async function deliverQueuedNotifications(limit = 10): Promise<void> {
  const queued = await db.notification.findMany({
    where: { status: "QUEUED", channel: "WHATSAPP" },
    orderBy: { createdAt: "asc" },
    take: limit,
    include: {
      owner: {
        select: {
          whatsappAlerts: true,
          whatsappPhone: true,
          callmebotApiKey: true,
        },
      },
    },
  });

  for (const n of queued) {
    // Claim the row — a parallel drain that lost this race skips it.
    const claimed = await db.notification.updateMany({
      where: { id: n.id, status: "QUEUED" },
      data: { status: "FAILED", error: "delivery in progress" },
    });
    if (claimed.count === 0) continue;

    const owner = n.owner;
    if (!owner || !owner.whatsappAlerts) {
      await db.notification.update({
        where: { id: n.id },
        data: { status: "FAILED", error: "alerts disabled by owner" },
      });
      continue;
    }
    if (!owner.whatsappPhone || !owner.callmebotApiKey) {
      await db.notification.update({
        where: { id: n.id },
        data: { status: "FAILED", error: "WhatsApp not configured (phone/API key missing)" },
      });
      continue;
    }

    const result = await sendWhatsApp(owner.whatsappPhone, owner.callmebotApiKey, n.message);
    await db.notification.update({
      where: { id: n.id },
      data: result.ok
        ? { status: "SENT", sentAt: new Date(), error: null }
        : { status: "FAILED", error: result.error ?? "unknown error" },
    });
  }
}

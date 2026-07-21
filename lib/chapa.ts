import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { requiredEnv } from "@/lib/env";

/**
 * Minimal Chapa gateway client. Server-only — the secret key must never
 * reach a client bundle.
 *
 * Payment lifecycle:
 *   initialize → donor pays on Chapa's hosted checkout → Chapa calls our
 *   webhook → we re-verify via the verify endpoint → only then SUCCESS.
 */

const CHAPA_BASE = "https://api.chapa.co/v1";

type ChapaInitResponse = {
  status: string;
  // Chapa returns a string on success/generic errors, but a field->messages
  // object on validation failures (e.g. { email: ["validation.email"] }).
  message: string | Record<string, string[] | string>;
  data?: { checkout_url: string };
};

/** Flatten Chapa's message (string or field-error object) to readable text. */
function chapaMessage(message: unknown, fallback: string): string {
  if (typeof message === "string" && message.trim()) return message;
  if (message && typeof message === "object") {
    const parts = Object.entries(message as Record<string, unknown>).map(
      ([field, val]) => `${field}: ${Array.isArray(val) ? val.join(", ") : String(val)}`
    );
    if (parts.length) return parts.join("; ");
  }
  return fallback;
}

export type ChapaVerifyData = {
  status: "success" | "failed" | "pending" | string;
  amount: number | string;
  currency: string;
  reference?: string;
  tx_ref?: string;
};

type ChapaVerifyResponse = {
  status: string;
  message: string;
  data?: ChapaVerifyData;
};

export async function initializeChapaPayment(params: {
  amount: number;
  currency: string;
  email: string;
  firstName: string;
  txRef: string;
  returnUrl: string;
  /**
   * When set, Chapa routes the fundraiser's share to this subaccount and keeps
   * the platform fee. The percentage the PLATFORM retains is `feeRate` (0.03).
   * Omitted for campaigns whose owner has no verified subaccount yet — the
   * donation still works; the fee is reconciled from our own fee_ledger.
   */
  subaccountId?: string;
  feeRate?: number;
}): Promise<{ ok: true; checkoutUrl: string } | { ok: false; error: string }> {
  const payload: Record<string, string> = {
    amount: String(params.amount),
    currency: params.currency,
    email: params.email,
    first_name: params.firstName,
    tx_ref: params.txRef,
    return_url: params.returnUrl,
    "customization[title]": "Yewogen Derash",
    "customization[description]": "Donation",
  };
  if (params.subaccountId) {
    // Chapa split: the platform takes `feeRate` as a percentage; the remainder
    // settles to the fundraiser's subaccount automatically at transaction time.
    payload["subaccounts[0][id]"] = params.subaccountId;
    payload["subaccounts[0][split_type]"] = "percentage";
    payload["subaccounts[0][split_value]"] = String(params.feeRate ?? 0.03);
  }
  const res = await fetch(`${CHAPA_BASE}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => null)) as ChapaInitResponse | null;
  if (!res.ok || body?.status !== "success" || !body.data?.checkout_url) {
    return {
      ok: false,
      error: chapaMessage(body?.message, `Gateway error (HTTP ${res.status})`),
    };
  }
  return { ok: true, checkoutUrl: body.data.checkout_url };
}

/** Authoritative post-payment check — the webhook alone is never trusted. */
export async function verifyChapaTransaction(
  txRef: string
): Promise<{ ok: true; data: ChapaVerifyData } | { ok: false; error: string }> {
  const res = await fetch(
    `${CHAPA_BASE}/transaction/verify/${encodeURIComponent(txRef)}`,
    {
      headers: { Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}` },
      cache: "no-store",
    }
  );
  const body = (await res.json().catch(() => null)) as ChapaVerifyResponse | null;
  if (!res.ok || body?.status !== "success" || !body.data) {
    return { ok: false, error: body?.message ?? `Verify failed (HTTP ${res.status})` };
  }
  return { ok: true, data: body.data };
}

/**
 * Verify a webhook signature. Chapa signs the raw payload with the webhook
 * secret (HMAC-SHA256, hex) — depending on account era the digest arrives in
 * `chapa-signature` or `x-chapa-signature`, so both are accepted.
 */
export function verifyChapaWebhookSignature(
  rawBody: string,
  headers: Headers
): boolean {
  const secret = requiredEnv("CHAPA_WEBHOOK_SECRET");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const candidates = [
    headers.get("chapa-signature"),
    headers.get("x-chapa-signature"),
  ];
  return candidates.some((sig) => {
    if (!sig || sig.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expected, "utf8"));
    } catch {
      return false;
    }
  });
}

// ── Subaccounts (split payments) ─────────────────────────────────

export type ChapaBank = { id: number; name: string; acct_length?: number };

/** Fetch the list of banks Chapa supports, for the payout-account form. */
export async function listChapaBanks(): Promise<
  { ok: true; banks: ChapaBank[] } | { ok: false; error: string }
> {
  const res = await fetch(`${CHAPA_BASE}/banks`, {
    headers: { Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}` },
    // Bank list is stable; let the platform cache it briefly.
    next: { revalidate: 3600 },
  });
  const body = (await res.json().catch(() => null)) as
    | { data?: ChapaBank[]; message?: unknown }
    | null;
  if (!res.ok || !Array.isArray(body?.data)) {
    return { ok: false, error: chapaMessage(body?.message, `Banks fetch failed (HTTP ${res.status})`) };
  }
  return { ok: true, banks: body.data };
}

/**
 * Create a Chapa subaccount for a fundraiser's verified bank account. The
 * returned subaccount id becomes the split target for that owner's donations.
 * `splitValue` is the PLATFORM's default percentage cut (0.03).
 */
export async function createChapaSubaccount(params: {
  businessName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  splitValue?: number;
}): Promise<{ ok: true; subaccountId: string } | { ok: false; error: string }> {
  const res = await fetch(`${CHAPA_BASE}/subaccount`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      business_name: params.businessName,
      account_name: params.accountName,
      bank_code: params.bankCode,
      account_number: params.accountNumber,
      split_type: "percentage",
      split_value: params.splitValue ?? 0.03,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => null)) as
    | { status?: string; message?: unknown; data?: { subaccount_id?: string } | string }
    | null;
  const subId =
    typeof body?.data === "object" ? body.data?.subaccount_id : undefined;
  if (!res.ok || body?.status !== "success" || !subId) {
    return {
      ok: false,
      error: chapaMessage(body?.message, `Subaccount creation failed (HTTP ${res.status})`),
    };
  }
  return { ok: true, subaccountId: subId };
}

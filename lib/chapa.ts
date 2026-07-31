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
  /*
   * NO SPLIT PARAMETERS, deliberately.
   *
   * This used to accept `subaccountId` + `feeRate` and add
   * subaccounts[0][split_value] to the payload. Removed rather than left unused,
   * because an unused money-routing parameter is one someone re-enables without
   * knowing either of the reasons it went:
   *
   * 1. Chapa states that "when a split payment is made, the funds are sent to the
   *    bank account associated with the subaccount". A split share is NOT held
   *    for later release — it reaches the fundraiser's bank as each donation
   *    settles, which removes the approval gate, the campaign-must-close rule,
   *    the one-withdrawal-per-campaign rule, and the ability to refund.
   *
   * 2. The direction of split_value was never confirmed. Chapa's percentage
   *    documentation reads as though the SUBACCOUNT receives split_value, while
   *    the old code here assumed the platform retained it. At 0.03 those two
   *    readings differ by 94% of every donation.
   *
   * Donations therefore arrive whole and are separated per campaign by our own
   * ledger. If a split is ever wanted, confirm (1) and (2) against a real Chapa
   * transaction first — see docs/PHASE-5-CHAPA-PAYOUTS.md.
   */
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

// ─────────────────────────────────────────────────────────────────────────────
//  TRANSFERS — money leaving the platform.
//
//  Everything above this line is money coming IN. A payment that fails costs
//  nothing: the donor retries. These functions move money OUT to a real
//  person's bank account, and a transfer sent twice is money gone.
//
//  Chapa's contract, confirmed against developer.chapa.co (July 2026):
//    POST /v1/transfers            required: account_number, amount, bank_code
//                                  optional: account_name, currency, reference
//                                  optional (TEST MODE ONLY): status, to
//                                            simulate success/failed/pending
//    GET  /v1/transfers/verify/:ref
//
//  `reference` is a merchant-supplied unique value and is what the verify
//  endpoint looks up. That makes it our idempotency key: generate one per
//  payout, store it BEFORE calling, and an interrupted attempt can always be
//  resolved by asking rather than by guessing or re-sending.
//
//  Their published docs do NOT fully specify the response body for either call.
//  So nothing here infers success from a shape it merely hopes for: an
//  unrecognised response is UNKNOWN, and UNKNOWN never means paid.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * What we are willing to conclude about a transfer.
 *
 * UNKNOWN is the important one and covers a timeout, a dropped connection, an
 * HTTP error, and a 200 whose body we cannot read. A payout in UNKNOWN must be
 * left alone and resolved by verifying with Chapa — never by sending again.
 */
export type TransferOutcome = "SUCCESS" | "FAILED" | "PENDING" | "UNKNOWN";

/**
 * Map a Chapa status string onto an outcome.
 *
 * Deliberately a whitelist. Anything unrecognised — a new status, a renamed one,
 * a typo, an empty string — becomes UNKNOWN rather than being optimistically
 * read as success, because the cost of those two mistakes is not symmetric.
 */
export function normaliseTransferStatus(raw: unknown): TransferOutcome {
  const s = String(raw ?? "").trim().toLowerCase();
  if (s === "success" || s === "successful" || s === "completed") return "SUCCESS";
  if (s === "failed" || s === "failure" || s === "cancelled" || s === "canceled")
    return "FAILED";
  if (s === "pending" || s === "queued" || s === "processing" || s === "new")
    return "PENDING";
  return "UNKNOWN";
}

/** Pull a transfer status out of a response body without assuming its shape. */
function readTransferStatus(body: unknown): TransferOutcome {
  const b = body as Record<string, unknown> | null;
  if (!b) return "UNKNOWN";
  const data = (b.data ?? null) as Record<string, unknown> | null;
  // Chapa puts the meaningful status inside `data` on verify, and uses the
  // top-level `status` as an envelope ("success" = the CALL worked, which says
  // nothing about the transfer). Prefer the inner one; fall back only when there
  // is no data object at all.
  const inner = data?.status ?? data?.transfer_status;
  if (inner !== undefined) return normaliseTransferStatus(inner);
  if (data) return "UNKNOWN";
  return normaliseTransferStatus(b.status);
}

/** Chapa's own identifier for the transfer, wherever they put it. */
function readTransferId(body: unknown): string | null {
  const data = (body as { data?: Record<string, unknown> } | null)?.data;
  for (const key of ["transfer_id", "id", "reference", "chapa_transfer_id", "tx_ref"]) {
    const v = data?.[key];
    if (typeof v === "string" && v) return v;
    if (typeof v === "number") return String(v);
  }
  return null;
}

export type TransferResult = {
  outcome: TransferOutcome;
  /** Chapa's handle, when they gave us one. */
  transferId: string | null;
  /** Verbatim response, stored on the payout so a dispute has evidence. */
  raw: unknown;
  /** Present when the outcome is FAILED or UNKNOWN. */
  error?: string;
};

/**
 * Ask Chapa to move money to a bank account.
 *
 * NOTE ON THE RETURN VALUE: this never throws for a transport problem. Throwing
 * would tempt a caller into a catch block that marks the payout failed, and
 * "the request timed out" is not evidence that money did not move. Transport
 * failures come back as UNKNOWN, which the caller must persist as PENDING and
 * leave for reconciliation.
 *
 * The caller must have already stored `reference` against the payout.
 */
export async function initiateChapaTransfer(params: {
  accountNumber: string;
  accountName?: string;
  amount: number;
  bankCode: string;
  reference: string;
  currency?: string;
  /** TEST MODE ONLY — asks Chapa to simulate an outcome. Never set in production. */
  simulateStatus?: "success" | "failed" | "pending";
}): Promise<TransferResult> {
  let res: Response;
  let body: unknown = null;
  try {
    res = await fetch(`${CHAPA_BASE}/transfers`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      body: JSON.stringify({
        account_number: params.accountNumber,
        amount: String(params.amount),
        bank_code: params.bankCode,
        reference: params.reference,
        currency: params.currency ?? "ETB",
        ...(params.accountName ? { account_name: params.accountName } : {}),
        ...(params.simulateStatus ? { status: params.simulateStatus } : {}),
      }),
    });
    body = await res.json().catch(() => null);
  } catch (e) {
    // Timed out, DNS, TLS, connection reset. The request may or may not have
    // reached them. This is precisely the case that must not look like failure.
    return {
      outcome: "UNKNOWN",
      transferId: null,
      raw: { transportError: String((e as Error)?.message ?? e) },
      error: "Could not confirm the transfer — its outcome is unknown.",
    };
  }

  const envelope = (body as { status?: unknown; message?: unknown } | null) ?? null;
  const message =
    typeof envelope?.message === "string" ? envelope.message : undefined;

  // A 4xx is a refusal to accept the instruction, which is safe to call FAILED —
  // the transfer was never queued. A 5xx is not: the instruction may have been
  // taken before their side broke, so that stays UNKNOWN.
  if (!res.ok) {
    const definitelyRejected = res.status >= 400 && res.status < 500;
    return {
      outcome: definitelyRejected ? "FAILED" : "UNKNOWN",
      transferId: readTransferId(body),
      raw: body ?? { httpStatus: res.status },
      error: message ?? `Transfer call failed (HTTP ${res.status})`,
    };
  }

  const outcome = readTransferStatus(body);
  return {
    outcome,
    transferId: readTransferId(body),
    raw: body,
    ...(outcome === "FAILED" || outcome === "UNKNOWN"
      ? { error: message ?? "Chapa did not confirm the transfer." }
      : {}),
  };
}

/**
 * Ask Chapa what became of a transfer we already sent. This is how a PENDING
 * payout is resolved — the only safe way, since re-sending would pay twice.
 */
export async function verifyChapaTransfer(reference: string): Promise<TransferResult> {
  let res: Response;
  let body: unknown = null;
  try {
    res = await fetch(
      `${CHAPA_BASE}/transfers/verify/${encodeURIComponent(reference)}`,
      {
        headers: { Authorization: `Bearer ${requiredEnv("CHAPA_SECRET_KEY")}` },
        cache: "no-store",
      }
    );
    body = await res.json().catch(() => null);
  } catch (e) {
    return {
      outcome: "UNKNOWN",
      transferId: null,
      raw: { transportError: String((e as Error)?.message ?? e) },
      error: "Could not reach Chapa to verify the transfer.",
    };
  }

  // A 404 here does NOT mean "no such transfer, therefore it never happened":
  // a reference can be unknown to them because it was never accepted, or
  // because it has not propagated yet. Either way we have learned nothing.
  if (!res.ok) {
    return {
      outcome: "UNKNOWN",
      transferId: null,
      raw: body ?? { httpStatus: res.status },
      error: `Verify failed (HTTP ${res.status})`,
    };
  }

  return {
    outcome: readTransferStatus(body),
    transferId: readTransferId(body),
    raw: body,
  };
}

/**
 * Whether the app is allowed to move money at all. Off unless explicitly on, so
 * merging this code changes nothing about who transfers funds.
 */
export function chapaTransfersEnabled(): boolean {
  return process.env.CHAPA_TRANSFERS_ENABLED === "true";
}

/**
 * Whether the configured secret key is a TEST key or a LIVE one. Chapa test
 * secrets are prefixed `CHASECK_TEST-`; live ones are not.
 *
 * This gates transfers, because a payout is the one operation where test mode is
 * actively dangerous rather than merely useless. A donation against a test key
 * wastes a click. A TRANSFER against one would have Chapa accept a simulated
 * instruction, the app mark the payout PAID, the fundraiser told their money was
 * sent, and the campaign's single withdrawal consumed — with nothing having moved
 * anywhere. The ledger would be wrong in the one direction nobody checks.
 *
 * "unknown" is returned rather than a guess when the key is missing or oddly
 * shaped, and callers must refuse on it too: "I could not tell" is not evidence
 * of a live key.
 */
export function chapaKeyMode(): "test" | "live" | "unknown" {
  const key = process.env.CHAPA_SECRET_KEY ?? "";
  if (!key) return "unknown";
  if (key.startsWith("CHASECK_TEST-")) return "test";
  if (key.startsWith("CHASECK")) return "live";
  return "unknown";
}

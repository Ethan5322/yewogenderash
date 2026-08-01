import { describe, it, expect, afterEach } from "vitest";
import { createHmac } from "node:crypto";
import { verifyChapaWebhookSignature } from "@/lib/chapa";

/**
 * The gate in front of the money-in endpoint.
 *
 * app/api/webhooks/chapa/route.ts calls this BEFORE anything else, and treats
 * false as "record the attempt, answer 401". Everything about donations settling
 * correctly depends on it saying yes only to Chapa.
 *
 * These tests exist because of a failure mode that was not about forgery at all:
 * the function read the secret through requiredEnv, which THROWS when it is
 * missing. Nothing was wrongly accepted — but the throw escaped before the route
 * could write its rejection row, so a misconfigured secret produced a 500, no
 * yd_webhook_events record, no audit trail, and Chapa retrying into silence while
 * donations quietly stopped settling.
 */
const SECRET = "test-webhook-secret";
const BODY = JSON.stringify({ tx_ref: "yd-test-123", status: "success", amount: 100 });

const sign = (body: string, secret = SECRET) =>
  createHmac("sha256", secret).update(body).digest("hex");

const headersWith = (name: string, value: string) => new Headers({ [name]: value });

describe("verifyChapaWebhookSignature", () => {
  const original = process.env.CHAPA_WEBHOOK_SECRET;
  afterEach(() => {
    if (original === undefined) delete process.env.CHAPA_WEBHOOK_SECRET;
    else process.env.CHAPA_WEBHOOK_SECRET = original;
  });

  it("accepts a correctly signed payload on either header spelling", () => {
    process.env.CHAPA_WEBHOOK_SECRET = SECRET;
    // Chapa sends one or the other depending on account era; both must work.
    for (const name of ["chapa-signature", "x-chapa-signature"]) {
      expect(
        verifyChapaWebhookSignature(BODY, headersWith(name, sign(BODY))),
        name
      ).toBe(true);
    }
  });

  it("rejects a payload signed with the wrong secret", () => {
    process.env.CHAPA_WEBHOOK_SECRET = SECRET;
    const forged = sign(BODY, "attacker-guessed-this");
    expect(
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", forged))
    ).toBe(false);
  });

  it("rejects a TAMPERED body even with a signature that was once valid", () => {
    // The replay-and-edit attack: capture a real webhook, change the amount,
    // resend it with the original signature.
    process.env.CHAPA_WEBHOOK_SECRET = SECRET;
    const realSig = sign(BODY);
    const tampered = JSON.stringify({
      tx_ref: "yd-test-123",
      status: "success",
      amount: 100000,
    });
    expect(
      verifyChapaWebhookSignature(tampered, headersWith("chapa-signature", realSig))
    ).toBe(false);
  });

  it("rejects a missing, empty or malformed signature", () => {
    process.env.CHAPA_WEBHOOK_SECRET = SECRET;
    expect(verifyChapaWebhookSignature(BODY, new Headers())).toBe(false);
    expect(
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", ""))
    ).toBe(false);
    expect(
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", "not-hex"))
    ).toBe(false);
    // Right length, wrong content — this is the case a naive length check passes.
    expect(
      verifyChapaWebhookSignature(
        BODY,
        headersWith("chapa-signature", "0".repeat(sign(BODY).length))
      )
    ).toBe(false);
  });

  it("RETURNS FALSE rather than throwing when the secret is not configured", () => {
    // The reason this file exists. It must fail closed AND stay a return value,
    // so the route can record "rejected_signature" instead of blowing up with a
    // 500 that leaves no trace of the attempt.
    delete process.env.CHAPA_WEBHOOK_SECRET;
    expect(() =>
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", sign(BODY)))
    ).not.toThrow();
    expect(
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", sign(BODY)))
    ).toBe(false);
  });

  it("an empty secret is treated as missing, not as a usable key", () => {
    // An env var set to "" is a misconfiguration, not a secret. Signing with ""
    // is perfectly possible, so this must not become a predictable accept path.
    process.env.CHAPA_WEBHOOK_SECRET = "";
    expect(
      verifyChapaWebhookSignature(BODY, headersWith("chapa-signature", sign(BODY, "")))
    ).toBe(false);
  });
});

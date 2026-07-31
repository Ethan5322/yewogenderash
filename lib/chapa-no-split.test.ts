import { describe, it, expect, vi, afterEach } from "vitest";
import { initializeChapaPayment } from "@/lib/chapa";

/**
 * A donation must reach the platform account WHOLE.
 *
 * This is a guard, not a feature test. Chapa splits are trivial to re-enable —
 * three lines in the payload — and doing so silently changes where donor money
 * physically goes, because Chapa sends a subaccount's share straight to that
 * subaccount's bank account rather than holding it. That would remove the
 * approval gate, the campaign-must-close rule and the one-withdrawal rule in one
 * edit, and nothing else in the suite would notice: every balance still
 * reconciles, because our ledger would go on describing money that had already
 * left.
 *
 * So the assertion is about the REQUEST we send, which is the only place the
 * decision is visible.
 */
describe("donation payment requests are never split", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Capture the outgoing request without touching the network. */
  async function capturePayload() {
    let captured: unknown = null;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        captured = JSON.parse(String(init?.body ?? "{}"));
        return {
          ok: true,
          status: 200,
          json: async () => ({
            status: "success",
            message: "ok",
            data: { checkout_url: "https://checkout.chapa.co/x" },
          }),
        } as unknown as Response;
      })
    );
    process.env.CHAPA_SECRET_KEY = "CHASECK_TEST-unit";

    const res = await initializeChapaPayment({
      amount: 100,
      currency: "ETB",
      email: "donor@example.com",
      firstName: "Donor",
      txRef: "unit-test-ref",
      returnUrl: "https://example.com/thanks",
    });
    expect(res.ok).toBe(true);
    return captured as Record<string, unknown>;
  }

  it("sends no subaccount and no split fields at all", async () => {
    const payload = await capturePayload();
    const keys = Object.keys(payload);

    // Any key mentioning a subaccount or a split means donor money is being
    // routed somewhere other than the platform account.
    const routing = keys.filter((k) => /subaccount|split/i.test(k));
    expect(routing, `unexpected routing fields: ${routing.join(", ")}`).toEqual([]);
  });

  it("still sends the whole amount, unreduced", async () => {
    const payload = await capturePayload();
    // 100 in, 100 charged. The 10% the platform keeps is applied in our ledger
    // afterwards, not by asking Chapa to divert part of the payment.
    expect(payload.amount).toBe("100");
    expect(payload.tx_ref).toBe("unit-test-ref");
  });
});

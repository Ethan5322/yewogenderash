import "server-only";

/**
 * Platform fee policy — single source of truth.
 *
 * The platform takes a flat 3% of every donation. With Chapa split payments
 * the cut is taken at transaction time (Chapa routes 97% to the fundraiser's
 * subaccount and 3% to the platform), but we ALSO record the exact split in
 * our own fee_ledger so the money is auditable independent of the gateway.
 *
 * Owners can never change this rate — it lives server-side only.
 */
export const PLATFORM_FEE_RATE = 0.03;

/**
 * Safety & guarantee withholding — 7% of the GROSS donated to a campaign,
 * charged ONCE per campaign and deducted from withdrawals.
 *
 * How it differs from the 3% above:
 *  - the 3% transaction fee is taken from each donation as it is paid, so the
 *    balance a fundraiser sees is already net of it (97% of gross);
 *  - this 7% is charged when funds are withdrawn, not when they arrive, so it is
 *    disclosed on the withdrawal request. It is charged against the campaign's
 *    gross once — a fundraiser who withdraws in instalments does not pay it
 *    again on the second instalment.
 *
 * It is retained by the platform (not a refundable deposit), so across the whole
 * lifetime of a campaign the fundraiser receives 90% of what donors gave. Both
 * deductions are stated in the Terms and on the public fees page.
 */
export const WITHHOLDING_FEE_RATE = 0.07;

/** Round to 2 decimals (birr cents) without float drift. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Split a gross donation into platform fee + net-to-campaign.
 * Net is computed as gross − fee so the two always reconcile to gross exactly.
 */
export function computeFeeSplit(
  gross: number,
  rate: number = PLATFORM_FEE_RATE
): { gross: number; fee: number; net: number; rate: number } {
  const g = round2(gross);
  const fee = round2(g * rate);
  const net = round2(g - fee);
  return { gross: g, fee, net, rate };
}

/**
 * The total safety & guarantee withholding a campaign owes over its lifetime:
 * 7% of everything donated to it (gross, before the 3% transaction fee).
 */
export function withholdingTotalFor(grossRaised: number): number {
  return round2(round2(grossRaised) * WITHHOLDING_FEE_RATE);
}

/**
 * Work out what a withdrawal actually pays out.
 *
 * `requested` is what the fundraiser asked for out of their (97%) balance.
 * `withholdingDue` is how much of the campaign's one-off 7% has not been
 * charged yet. The outstanding withholding is taken from this withdrawal, up to
 * the amount being withdrawn — so a fundraiser is never asked to pay more than
 * they are taking out, and any remainder rolls to their next withdrawal.
 */
export function computeWithdrawal(
  requested: number,
  withholdingDue: number
): { requested: number; withholding: number; net: number } {
  const req = round2(Math.max(0, requested));
  const withholding = round2(Math.min(Math.max(0, withholdingDue), req));
  return { requested: req, withholding, net: round2(req - withholding) };
}

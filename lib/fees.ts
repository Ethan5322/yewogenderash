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

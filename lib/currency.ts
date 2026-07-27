/**
 * Indicative foreign-currency display for diaspora donors.
 *
 * Campaigns are denominated and charged in ETB — this only ever produces a
 * secondary "roughly this much" figure so someone abroad can judge the size of a
 * gift without opening a converter.
 *
 * Deliberately driven by a configured rate rather than a live feed, and it
 * returns null when no rate is configured. A stale or wrong exchange rate shown
 * next to a real amount of money is worse than showing nothing, so the absence
 * of configuration means the conversion simply does not appear.
 *
 * Set NEXT_PUBLIC_ETB_PER_USD to the approximate birr-per-dollar rate to switch
 * it on, and revisit it when the rate moves materially.
 */

/** Birr per 1 USD, or null when not configured / not a sane number. */
export function etbPerUsd(): number | null {
  const raw = process.env.NEXT_PUBLIC_ETB_PER_USD;
  if (!raw) return null;
  const n = Number(raw);
  // A rate outside this range is a configuration mistake, not a market move.
  if (!Number.isFinite(n) || n < 1 || n > 100_000) return null;
  return n;
}

/**
 * Round a converted figure to something that reads as an estimate rather than a
 * quote: whole dollars, and to the nearest 5 once it is large enough that false
 * precision would be misleading.
 */
export function roundIndicative(usd: number): number {
  if (usd < 20) return Math.round(usd);
  if (usd < 1000) return Math.round(usd / 5) * 5;
  return Math.round(usd / 50) * 50;
}

/**
 * Indicative USD string for an ETB amount, or null when no rate is configured.
 * Always prefixed with "≈" — it is an estimate, never a price.
 */
export function indicativeUsd(etb: number): string | null {
  const rate = etbPerUsd();
  if (!rate || !Number.isFinite(etb) || etb <= 0) return null;
  const usd = roundIndicative(etb / rate);
  if (usd <= 0) return null;
  return `≈ USD ${usd.toLocaleString("en-US")}`;
}

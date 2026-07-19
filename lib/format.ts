// Display formatting helpers. Money is stored as Decimal(12,2); we convert to
// number only at the display boundary (max 9,999,999,999.99 is well within the
// JS safe-integer range for whole birr), never for arithmetic on balances.

type Decimalish = number | string | { toString(): string };

/** Coerce a Prisma Decimal / string / number to a plain number for display. */
export function toNumber(value: Decimalish): number {
  return typeof value === "number" ? value : Number(value.toString());
}

/** Format an amount as Ethiopian Birr, e.g. "ETB 12,500". */
export function formatETB(value: Decimalish, currency = "ETB"): string {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
    minimumFractionDigits: 0,
  }).format(n);
  return `${currency} ${formatted}`;
}

/** Compact form for tight spaces, e.g. "12.5K". */
export function formatCompact(value: Decimalish): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(toNumber(value));
}

/** Funding progress as an integer percentage, clamped to 0–100. */
export function progressPercent(current: Decimalish, target: Decimalish): number {
  const t = toNumber(target);
  if (t <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((toNumber(current) / t) * 100)));
}

/** Human date, e.g. "19 Jul 2026". */
export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(typeof date === "string" ? new Date(date) : date);
}

/** Relative time, e.g. "3 days ago". Falls back to a date for old items. */
export function timeAgo(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const table: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31536000],
    ["month", 2592000],
    ["week", 604800],
    ["day", 86400],
    ["hour", 3600],
    ["minute", 60],
  ];
  for (const [unit, secs] of table) {
    if (Math.abs(seconds) >= secs) return rtf.format(-Math.round(seconds / secs), unit);
  }
  return rtf.format(-seconds, "second");
}

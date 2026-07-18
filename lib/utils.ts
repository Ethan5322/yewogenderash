import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class lists without duplicate/conflicting utilities. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an amount in a currency for display (defaults to Ethiopian Birr). */
export function formatMoney(amount: number, currency: string = "ETB") {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Percentage of target raised, clamped to 0–100 for progress bars. */
export function progressPercent(raised: number, target: number) {
  if (target <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((raised / target) * 100)));
}

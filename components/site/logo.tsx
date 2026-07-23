import Link from "next/link";
import { cn } from "@/lib/utils";
import { BRAND_GOLD, BRAND_HAND_PATHS, BRAND_HEART_PATH } from "@/lib/brand";

/**
 * Brand mark — a heart cradled in open hands ("giving, held safely").
 * `tone="onDark"` swaps the hands to white for dark surfaces; the gold heart
 * carries across both. Standalone files live in /public/brand.
 */
export function LogoMark({
  className,
  tone = "color",
}: {
  className?: string;
  tone?: "color" | "onDark";
}) {
  const hands = tone === "onDark" ? "#ffffff" : "var(--primary, #0f7a4d)";
  const heart = tone === "onDark" ? "#e8b04b" : BRAND_GOLD;
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-hidden focusable="false">
      <path d={BRAND_HEART_PATH} fill={heart} />
      {BRAND_HAND_PATHS.map((d) => (
        <path key={d} d={d} fill={hands} />
      ))}
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-display", className)}
      aria-label="Yewogen Derash — home"
    >
      <LogoMark className="h-8 w-8 shrink-0" />
      <span className="text-lg font-bold leading-none tracking-tight">
        Yewogen <span className="text-primary">Derash</span>
      </span>
    </Link>
  );
}

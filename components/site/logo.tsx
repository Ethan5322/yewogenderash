import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Brand mark — a trust shield holding a heart ("verified giving"). Deliberately
 * distinct from the generic hand-heart. `tone="onDark"` swaps to the white-shield
 * variant for dark surfaces. Standalone files live in /public/brand.
 */
export function LogoMark({
  className,
  tone = "color",
}: {
  className?: string;
  tone?: "color" | "onDark";
}) {
  const shield = tone === "onDark" ? "#ffffff" : "var(--primary, #0f7a4d)";
  const heart = tone === "onDark" ? "#12a05f" : "#ffffff";
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-hidden focusable="false">
      <path
        d="M12 2.4 19.6 5.2 V11 C19.6 15.9 16.3 19.6 12 21.7 C7.7 19.6 4.4 15.9 4.4 11 V5.2 Z"
        fill={shield}
      />
      <path
        d="M12 16.5 C11.85 16.5 6.9 13.35 6.9 9.75 C6.9 8.12 8.12 6.9 9.6 6.9 C10.68 6.9 11.62 7.56 12 8.46 C12.38 7.56 13.32 6.9 14.4 6.9 C15.88 6.9 17.1 8.12 17.1 9.75 C17.1 13.35 12.15 16.5 12 16.5 Z"
        fill={heart}
      />
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

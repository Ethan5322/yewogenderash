"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

/**
 * Public-site language toggle. `label` (from the server dictionary) is the
 * language you can switch TO — "አማርኛ" while in English, "English" while in
 * Amharic. Sets the `locale` cookie and refreshes so server components re-render
 * in the chosen language.
 */
export function LanguageSwitcher({ label, className }: { label: string; className?: string }) {
  const router = useRouter();

  function toggle() {
    const current = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/)?.[1] ?? "en";
    const next = current === "am" ? "en" : "am";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      }
      aria-label={`Switch language to ${label}`}
    >
      <Languages className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );
}

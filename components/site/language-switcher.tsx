"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";

/**
 * Public-site language toggle. On the public site the server passes `label`
 * (the language you can switch TO) so there's no flash; elsewhere (e.g. the
 * dashboard) it reads the cookie itself. Sets the `locale` cookie and refreshes
 * so server components re-render in the chosen language.
 */
export function LanguageSwitcher({ label, className }: { label?: string; className?: string }) {
  const router = useRouter();
  const [locale, setLocale] = React.useState<"en" | "am">("en");

  React.useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)locale=([^;]+)/);
    setLocale(m?.[1] === "am" ? "am" : "en");
  }, []);

  const shown = label ?? (locale === "am" ? "English" : "አማርኛ");

  function toggle() {
    const next = locale === "am" ? "en" : "am";
    document.cookie = `locale=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    setLocale(next);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        "inline-flex h-9 items-center gap-1.5 rounded-full border border-input bg-background px-3 text-sm font-semibold text-foreground shadow-sm transition-colors hover:bg-accent"
      }
      aria-label={`Switch language to ${shown}`}
    >
      <Languages className="h-4 w-4" aria-hidden />
      {shown}
    </button>
  );
}

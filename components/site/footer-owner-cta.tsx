"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The single "Are you a campaign owner?" entry point. Shown ONCE, only in the
 * footer, and only on general pages — never on the homepage and never inside
 * the registration/auth flow (where it confuses users and could interrupt an
 * in-progress registration).
 */
const HIDDEN_PREFIXES = ["/start", "/register", "/login", "/admin-login"];

export function FooterOwnerCta() {
  const pathname = usePathname() ?? "";
  const hidden =
    pathname === "/" || HIDDEN_PREFIXES.some((p) => pathname.startsWith(p));
  if (hidden) return null;

  return (
    <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border bg-background p-5 text-center sm:flex-row sm:text-left">
      <div>
        <p className="font-medium">Are you a campaign owner?</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Sign in to manage your campaigns, or get verified to start raising
          funds.
        </p>
      </div>
      <div className="flex shrink-0 gap-3">
        <Link
          href="/login"
          className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          Sign in
        </Link>
        <Link
          href="/start"
          className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Register as a campaign owner
        </Link>
      </div>
    </div>
  );
}

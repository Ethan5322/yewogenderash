"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The single "Are you a campaign owner?" entry point. Shown ONCE, only in the
 * footer, and only to people it could possibly apply to.
 *
 * Hidden for anyone already SIGNED IN. A fundraiser inside their own account was
 * being asked "Are you a campaign owner? Sign in to manage your campaigns" at the
 * bottom of every screen — the site apparently not knowing who was reading it.
 * That is the real condition, not the URL: it also covers a signed-in fundraiser
 * browsing /campaigns, which a path list would have missed.
 *
 * Still hidden on the homepage and inside the auth flow, where it either
 * duplicates a prominent call to action or interrupts a registration in progress.
 */
const HIDDEN_PREFIXES = ["/start", "/register", "/login", "/admin-login"];

/**
 * The whole decision, as a pure function so it can be tested directly.
 *
 * Extracted deliberately. The e2e suite runs its dev server against the real
 * Supabase database, so proving the signed-in case in a browser would mean
 * creating a fundraiser account in production — not an acceptable price for one
 * assertion. This keeps the logic verifiable without it.
 */
export function shouldHideOwnerCta(args: {
  signedIn: boolean;
  pathname: string;
}): boolean {
  if (args.signedIn) return true;
  if (args.pathname === "/") return true;
  return HIDDEN_PREFIXES.some((p) => args.pathname.startsWith(p));
}

export function FooterOwnerCta({
  signedIn = false,
  heading = "Are you a campaign owner?",
  sub = "Sign in to manage your campaigns, or get verified to start raising funds.",
  signIn = "Sign in",
  register = "Register as a campaign owner",
}: {
  /** Resolved on the server. The browser does not decide this. */
  signedIn?: boolean;
  heading?: string;
  sub?: string;
  signIn?: string;
  register?: string;
} = {}) {
  const pathname = usePathname() ?? "";
  if (shouldHideOwnerCta({ signedIn, pathname })) return null;

  return (
    <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border bg-background p-5 text-center sm:flex-row sm:text-left">
      <div>
        <p className="font-medium">{heading}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p>
      </div>
      {/* Full-width stacked on phones — side by side these labels wrapped to two
          lines inside a fixed-height button and clipped. */}
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:shrink-0 sm:flex-row">
        <Link
          href="/login"
          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          {signIn}
        </Link>
        <Link
          href="/start"
          className="inline-flex h-9 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          {register}
        </Link>
      </div>
    </div>
  );
}

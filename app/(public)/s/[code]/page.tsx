import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck, LogIn, Globe } from "lucide-react";
import { Logo } from "@/components/site/logo";

type Params = { params: Promise<{ code: string }> };

export const metadata: Metadata = {
  title: "Staff card",
  // A staff card landing page has no business in search results.
  robots: { index: false, follow: false },
};

/** The staff-code shape issued by the team screen, e.g. YWD-ADM-7KQ2. */
const STAFF_CODE = /^YWD-ADM-[A-Z0-9]{2,12}$/;

/**
 * Where an admin's staff-ID QR lands: two ways on, and nothing else.
 *
 * Deliberately does NOT look the code up. The page offers the same two choices
 * either way, so a valid code and an invented one are indistinguishable — a
 * staff code is short, and a page that confirmed "this one is real" would let
 * anyone test guesses until they found a live admin. It also means no database
 * query on a route anybody can hit.
 *
 * Option A goes to the normal staff sign-in. Scanning the card proves nothing —
 * cards get photographed — so the admin still authenticates there exactly as
 * they do today. The code is echoed back only because it is printed on the card
 * already being held.
 */
export default async function StaffCardPage({ params }: Params) {
  const { code } = await params;
  const shown = decodeURIComponent(code).toUpperCase().slice(0, 20);
  const looksLikeStaffCode = STAFF_CODE.test(shown);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-12 sm:px-6">
      <div className="rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Logo className="h-9" />
          <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Staff card
          </p>
          {looksLikeStaffCode ? (
            <p className="mt-3 font-mono text-sm text-muted-foreground">{shown}</p>
          ) : null}
          <h1 className="mt-3 font-display text-xl font-bold tracking-tight">
            What would you like to do?
          </h1>
        </div>

        <div className="mt-7 space-y-3">
          <Link
            href="/admin-login"
            className="flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/5 p-4 transition-colors hover:bg-primary/10"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <LogIn className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">A. Log in to admin panel</span>
              <span className="block text-xs text-muted-foreground">
                You&apos;ll sign in with your staff code and password, or your face.
              </span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-3 rounded-xl border p-4 transition-colors hover:bg-accent/40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <Globe className="h-5 w-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">B. Visit the public site</span>
              <span className="block text-xs text-muted-foreground">
                Browse verified campaigns on Yewogen Derash.
              </span>
            </span>
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Scanning this card does not sign anyone in.
        </p>
      </div>
    </div>
  );
}


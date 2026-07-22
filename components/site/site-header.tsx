"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/campaigns", label: "Campaigns" },
  { href: "/support", label: "Support" },
] as const;

type HeaderUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

/** Where a signed-in user's "home" is, by role. */
function accountHome(role?: string | null): { href: string; label: string } {
  if (role === "ADMIN") return { href: "/admin", label: "Admin panel" };
  return { href: "/dashboard", label: "Dashboard" };
}

export function SiteHeader({ user }: { user?: HeaderUser }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the mobile drawer on navigation.
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const home = accountHome(user?.role);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
                pathname?.startsWith(link.href) && "text-foreground"
              )}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="max-w-[14rem] truncate text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button asChild size="sm">
                <Link href={home.href}>{home.label}</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                <LogOut className="h-4 w-4" aria-hidden /> Sign out
              </Button>
            </>
          ) : (
            // Public visitors: no owner CTA in the global header — the single
            // "become a fundraiser" entry lives in the footer (general pages).
            // Just a donor-facing sign-in for returning users.
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
          )}
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-accent md:hidden"
          aria-expanded={open}
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href={home.href}
                  className="rounded-md px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent"
                >
                  {home.label}
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </>
            ) : (
              <Button asChild variant="outline" className="mt-2">
                <Link href="/login">Sign in</Link>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

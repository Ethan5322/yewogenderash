"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { Menu, X, LogOut } from "lucide-react";
import { Logo } from "@/components/site/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Dict } from "@/lib/i18n";

type HeaderUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
} | null;

// English fallback used when no dictionary is passed (e.g. dashboard header).
const EN = {
  campaigns: "Campaigns",
  start: "Start a campaign",
  support: "Support",
  signIn: "Sign in",
  signOut: "Sign out",
  dashboard: "Dashboard",
  adminPanel: "Admin panel",
};

/** Where a signed-in user's "home" is, by role. */
function accountHome(role: string | null | undefined, t: typeof EN): { href: string; label: string } {
  if (role === "ADMIN") return { href: "/admin", label: t.adminPanel };
  return { href: "/dashboard", label: t.dashboard };
}

export function SiteHeader({ user, dict }: { user?: HeaderUser; dict?: Dict }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const t = dict?.nav ?? EN;
  const navLinks = [
    { href: "/campaigns", label: t.campaigns },
    { href: "/start", label: t.start },
    { href: "/support", label: t.support },
  ];
  const home = accountHome(user?.role, t);

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {navLinks.map((link) => (
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

        <div className="hidden items-center gap-2 md:flex">
          <LanguageSwitcher label={dict?.switchLabel} />
          {user ? (
            <>
              <span className="max-w-[12rem] truncate text-sm text-muted-foreground">
                {user.name || user.email}
              </span>
              <Button asChild size="sm">
                <Link href={home.href}>{home.label}</Link>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                <LogOut className="h-4 w-4" aria-hidden /> {t.signOut}
              </Button>
            </>
          ) : (
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">{t.signIn}</Link>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <LanguageSwitcher label={dict?.switchLabel} />
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground hover:bg-accent"
            aria-expanded={open}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t bg-background md:hidden">
          <nav className="flex flex-col gap-1 p-4" aria-label="Mobile">
            {navLinks.map((link) => (
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
                  <LogOut className="h-4 w-4" aria-hidden /> {t.signOut}
                </button>
              </>
            ) : (
              <Button asChild variant="outline" className="mt-2">
                <Link href="/login">{t.signIn}</Link>
              </Button>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Megaphone,
  BadgeCheck,
  Landmark,
  FileText,
  Users,
  ScrollText,
  LogOut,
  ExternalLink,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard,
  campaigns: Megaphone,
  kyc: BadgeCheck,
  payouts: Landmark,
  content: FileText,
  admins: Users,
  audit: ScrollText,
} as const;

export type AdminNavItem = {
  href: string;
  label: string;
  key: keyof typeof ICONS;
};

export function AdminShell({
  nav,
  email,
  isSuper,
  children,
}: {
  nav: AdminNavItem[];
  email: string;
  isSuper: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const badge = (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
      {isSuper ? "MAIN ADMIN" : "ADMIN"}
    </span>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r bg-card md:flex">
        <div className="flex h-16 items-center gap-2 border-b px-5">
          <Logo />
          {badge}
        </div>
        <nav className="flex-1 space-y-1 p-3" aria-label="Admin">
          {nav.map((item) => {
            const Icon = ICONS[item.key];
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active(item.href)
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="space-y-1 border-t p-3">
          <p className="truncate px-3 pb-1 text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          <Link
            href="/"
            className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <ExternalLink className="h-4 w-4 shrink-0" aria-hidden /> View site
          </Link>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4 shrink-0" aria-hidden /> Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar + nav */}
        <header className="flex items-center justify-between border-b bg-card px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <Logo />
            {badge}
          </div>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            aria-label="Sign out"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
          >
            <LogOut className="h-4 w-4" aria-hidden />
          </button>
        </header>
        <nav
          className="flex gap-3 overflow-x-auto border-b bg-card px-4 py-2 md:hidden"
          aria-label="Admin mobile"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "whitespace-nowrap text-sm font-medium transition-colors",
                active(item.href) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

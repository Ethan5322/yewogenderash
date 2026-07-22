"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Megaphone,
  BadgeCheck,
  Landmark,
  Receipt,
  CreditCard,
  QrCode,
  Bell,
  FileText,
  Newspaper,
  MessageSquare,
  LifeBuoy,
  Users,
  ShieldCheck,
  ScrollText,
  BarChart3,
  Activity,
  Settings,
  LogOut,
  ExternalLink,
  Search,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { Logo } from "@/components/site/logo";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard,
  campaigns: Megaphone,
  kyc: BadgeCheck,
  owners: Users,
  payouts: Landmark,
  donations: Receipt,
  payments: CreditCard,
  querycodes: QrCode,
  notifications: Bell,
  content: FileText,
  blog: Newspaper,
  reports: BarChart3,
  messages: MessageSquare,
  support: LifeBuoy,
  admins: ShieldCheck,
  audit: ScrollText,
  system: Activity,
  settings: Settings,
} as const;

export type AdminNavItem = {
  href: string;
  label: string;
  key: keyof typeof ICONS;
  badge?: number;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export type AdminAlert = { label: string; href: string; count: number };

export function AdminShell({
  groups,
  email,
  name,
  adminCode,
  isSuper,
  roleLabel,
  alerts,
  children,
}: {
  groups: AdminNavGroup[];
  email: string;
  name: string;
  adminCode?: string | null;
  isSuper: boolean;
  roleLabel: string;
  alerts: AdminAlert[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  // Close the mobile drawer on navigation.
  React.useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const alertTotal = alerts.reduce((n, a) => n + a.count, 0);

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <Logo />
        <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          {isSuper ? "Super" : "Staff"}
        </span>
      </div>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4" aria-label="Admin">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = ICONS[item.key];
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          "inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground"
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar — desktop */}
      <aside className="hidden w-60 shrink-0 border-r bg-card md:block">
        <div className="sticky top-0 h-screen">{sidebar}</div>
      </aside>

      {/* Sidebar — mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-card shadow-xl">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
              aria-label="Close menu"
            >
              <X className="h-4 w-4" />
            </button>
            {sidebar}
          </div>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top header */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-card/95 px-3 backdrop-blur sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Global search */}
          <form action="/admin/search" className="relative hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              placeholder="Search campaigns, owners, donations, references…"
              className="h-9 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </form>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Alerts */}
            <details className="group relative">
              <summary className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-md text-muted-foreground hover:bg-accent [&::-webkit-details-marker]:hidden">
                <span className="relative">
                  <Bell className="h-5 w-5" aria-hidden />
                  {alertTotal > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
                      {alertTotal > 99 ? "99+" : alertTotal}
                    </span>
                  ) : null}
                </span>
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-72 rounded-lg border bg-card p-2 shadow-lg">
                <p className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Action required
                </p>
                {alerts.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-muted-foreground">
                    All clear — nothing pending.
                  </p>
                ) : (
                  alerts.map((a) => (
                    <Link
                      key={a.label}
                      href={a.href}
                      className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <span>{a.label}</span>
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                        {a.count}
                      </span>
                    </Link>
                  ))
                )}
              </div>
            </details>

            {/* Profile */}
            <details className="group relative">
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md py-1 pl-1.5 pr-2 hover:bg-accent [&::-webkit-details-marker]:hidden">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <span className="hidden text-left sm:block">
                  <span className="block text-xs font-semibold leading-tight">{name}</span>
                  <span className="block text-[11px] leading-tight text-muted-foreground">
                    {roleLabel}
                  </span>
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />
              </summary>
              <div className="absolute right-0 z-40 mt-2 w-64 rounded-lg border bg-card p-2 shadow-lg">
                <div className="border-b px-2 pb-2">
                  <p className="truncate text-sm font-medium" title={email}>
                    {email}
                  </p>
                  <p className="text-xs text-muted-foreground">{roleLabel}</p>
                  {adminCode ? (
                    <p className="mt-0.5 font-mono text-[11px] tracking-wider text-muted-foreground/70">
                      Staff ID · {adminCode}
                    </p>
                  ) : null}
                </div>
                <Link
                  href="/"
                  className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" aria-hidden /> View public site
                </Link>
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <LogOut className="h-4 w-4" aria-hidden /> Sign out
                </button>
              </div>
            </details>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Megaphone,
  Landmark,
  MessageSquare,
  IdCard,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  overview: LayoutDashboard,
  campaigns: Megaphone,
  payouts: Landmark,
  messages: MessageSquare,
  id: IdCard,
  settings: Settings,
} as const;

export type DashboardNavItem = {
  href: string;
  label: string;
  key: keyof typeof ICONS;
  /** Unread count; rendered as a badge when greater than zero. */
  badge?: number;
};

/**
 * The fundraiser's persistent navigation, arranged differently on the two
 * devices rather than one bar stretched across both.
 *
 * Every dashboard screen used to be an island: the only route from Payouts to
 * Messages was the back arrow to the dashboard and a fresh click. Admins have
 * had a sidebar the whole time; this gives fundraisers the same standing.
 *
 * DESKTOP — a tab strip under the site header, where the eye already is after
 *   reading the logo, and where a wide window has room to spare.
 *
 * PHONE — a fixed bottom bar. The desktop strip technically fitted a phone by
 *   scrolling sideways, but a tab you have to swipe to discover is a tab most
 *   people never find; and the top of a phone screen is the hardest place for
 *   a thumb to reach. Every section is now one tap, always visible.
 *
 * The admin panel deliberately keeps its sidebar-and-drawer instead: an
 * operator working a queue wants every module one click away all day, which is
 * a different job from a fundraiser checking one campaign. Same visual
 * language, different shape, chosen per role.
 */
export function DashboardNavBar({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname() ?? "";

  /** Longest-prefix match, so /dashboard/campaigns/x highlights Campaigns and
   *  not Overview (every path starts with /dashboard). */
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  /**
   * "My ID" is dropped from the phone bar, not from the phone.
   *
   * Six targets across a small screen makes each one too narrow to hit
   * reliably, and the ID is a thing you open occasionally rather than move
   * between — it keeps its own card on the overview screen. The desktop strip
   * still shows all six.
   */
  const phoneItems = items.filter((i) => i.key !== "id");

  return (
    <>
      {/* ── Desktop: tab strip under the header ────────────────────────── */}
      <nav
        aria-label="Fundraiser sections"
        className="sticky top-0 z-30 hidden border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:block"
      >
        <ul className="mx-auto flex max-w-5xl gap-1 px-2 sm:px-4">
          {items.map((item) => {
            const Icon = ICONS[item.key];
            const active = item.href === activeHref;
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {item.label}
                  {item.badge ? (
                    <span
                      className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground"
                      aria-label={`${item.badge} unread`}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ── Phone: fixed bottom bar ────────────────────────────────────── */}
      <nav
        aria-label="Fundraiser sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden"
      >
        <ul className="flex">
          {phoneItems.map((item) => {
            const Icon = ICONS[item.key];
            const active = item.href === activeHref;
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    // min-h-14 keeps every target at least 56px tall — below
                    // that a thumb starts missing.
                    "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 transition-colors",
                    active ? "text-primary" : "text-muted-foreground active:bg-accent"
                  )}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden />
                    {item.badge ? (
                      <span
                        className="absolute -right-2 -top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground"
                        aria-label={`${item.badge} unread`}
                      >
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    ) : null}
                  </span>
                  <span className="w-full truncate text-center text-[10px] font-medium leading-tight">
                    {item.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

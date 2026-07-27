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
 * The fundraiser's persistent navigation.
 *
 * Every dashboard screen used to be an island: the only route from Payouts to
 * Messages was the back arrow to the dashboard and a fresh click. Admins have
 * had a sidebar the whole time; this gives fundraisers the same standing, as a
 * horizontal bar so it costs no width on a phone.
 */
export function DashboardNavBar({ items }: { items: DashboardNavItem[] }) {
  const pathname = usePathname() ?? "";

  /** Longest-prefix match, so /dashboard/campaigns/x highlights Campaigns and
   *  not Overview (every path starts with /dashboard). */
  const activeHref = items
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <nav
      aria-label="Fundraiser sections"
      className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
    >
      <ul className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-2 sm:px-4">
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
  );
}

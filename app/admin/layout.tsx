import Link from "next/link";
import { Logo } from "@/components/site/logo";
import {
  currentAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";

const ADMIN_NAV: { href: string; label: string; perm?: AdminPermission }[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/campaigns", label: "Campaigns", perm: "campaigns" },
  { href: "/admin/owners", label: "Owners (KYC)", perm: "kyc" },
  { href: "/admin/payouts", label: "Payouts", perm: "payouts" },
  { href: "/admin/content", label: "Content", perm: "content" },
  { href: "/admin/team", label: "Team", perm: "admins" },
];

export const metadata = { title: "Admin" };

/**
 * Admin shell. The role and per-capability permissions are re-verified
 * SERVER-SIDE here on every request (currentAdmin loads fresh from the DB) —
 * middleware/JWT alone is never trusted for the financial control room. The nav
 * shows only the sections this admin is allowed to use.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await currentAdmin();
  const nav = ADMIN_NAV.filter((item) => !item.perm || hasPermission(me, item.perm));

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              {me.isSuperAdmin ? "MAIN ADMIN" : "ADMIN"}
            </span>
          </div>
          <nav className="hidden items-center gap-5 md:flex" aria-label="Admin">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <span className="text-xs text-muted-foreground">{me.email}</span>
        </div>
        {/* Mobile nav */}
        <nav
          className="flex gap-4 overflow-x-auto border-t px-4 py-2 md:hidden"
          aria-label="Admin mobile"
        >
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

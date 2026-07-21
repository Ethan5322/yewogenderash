import {
  currentAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell";

const ADMIN_NAV: (AdminNavItem & { perm?: AdminPermission })[] = [
  { href: "/admin", label: "Overview", key: "overview" },
  { href: "/admin/campaigns", label: "Campaigns", key: "campaigns", perm: "campaigns" },
  { href: "/admin/owners", label: "Owners (KYC)", key: "kyc", perm: "kyc" },
  { href: "/admin/payouts", label: "Payouts", key: "payouts", perm: "payouts" },
  { href: "/admin/content", label: "Content", key: "content", perm: "content" },
  { href: "/admin/blog", label: "Blog", key: "blog", perm: "content" },
  { href: "/admin/messages", label: "Messages", key: "messages", perm: "messages" },
  { href: "/admin/team", label: "Team", key: "admins", perm: "admins" },
  { href: "/admin/audit", label: "Audit", key: "audit", perm: "admins" },
];

export const metadata = { title: "Admin" };

/**
 * Admin shell. Role and per-capability permissions are re-verified SERVER-SIDE
 * here on every request (currentAdmin loads fresh from the DB) — middleware/JWT
 * alone is never trusted for the financial control room. The sidebar shows only
 * the sections this admin is allowed to use.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await currentAdmin();
  const nav: AdminNavItem[] = ADMIN_NAV.filter(
    (item) => !item.perm || hasPermission(me, item.perm)
  ).map(({ href, label, key }) => ({ href, label, key }));

  return (
    <AdminShell nav={nav} email={me.email} isSuper={me.isSuperAdmin}>
      {children}
    </AdminShell>
  );
}

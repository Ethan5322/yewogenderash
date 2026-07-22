import {
  currentAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";
import { db } from "@/lib/db";
import { adminUnreadTotal } from "@/lib/messages";
import { AdminShell, type AdminNavItem } from "@/components/admin/admin-shell";

const ADMIN_NAV: (AdminNavItem & { perm?: AdminPermission; superOnly?: boolean })[] = [
  { href: "/admin", label: "Overview", key: "overview" },
  { href: "/admin/campaigns", label: "Campaigns", key: "campaigns", perm: "campaigns" },
  { href: "/admin/owners", label: "Owners (KYC)", key: "kyc", perm: "kyc" },
  { href: "/admin/payouts", label: "Payouts", key: "payouts", perm: "payouts" },
  { href: "/admin/donations", label: "Donations", key: "donations", perm: "payouts" },
  { href: "/admin/payments", label: "Payments", key: "payments", perm: "payouts" },
  { href: "/admin/content", label: "Content", key: "content", perm: "content" },
  { href: "/admin/blog", label: "Blog", key: "blog", perm: "content" },
  { href: "/admin/messages", label: "Messages", key: "messages", perm: "messages" },
  { href: "/admin/support", label: "Support", key: "support", perm: "messages" },
  { href: "/admin/team", label: "Team", key: "admins", perm: "admins" },
  { href: "/admin/audit", label: "Audit", key: "audit", perm: "admins" },
  { href: "/admin/settings", label: "Settings", key: "settings", superOnly: true },
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

  // Pending-work counts drive the sidebar badges (only the sections this admin
  // can act on need a number).
  const [pendingKyc, pendingCampaigns, pendingPayouts, unreadMessages, openSupport] =
    await Promise.all([
      db.user.count({ where: { verificationStatus: "PENDING", ownerProfile: { isNot: null } } }),
      db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
      db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
      adminUnreadTotal(),
      db.supportMessage.count({ where: { status: "OPEN" } }),
    ]);
  const badgeFor: Partial<Record<string, number>> = {
    kyc: pendingKyc,
    campaigns: pendingCampaigns,
    payouts: pendingPayouts,
    messages: unreadMessages,
    support: openSupport,
  };

  const nav: AdminNavItem[] = ADMIN_NAV.filter(
    (item) =>
      (item.superOnly ? me.isSuperAdmin : true) &&
      (!item.perm || hasPermission(me, item.perm))
  ).map(({ href, label, key }) => ({ href, label, key, badge: badgeFor[key] || undefined }));

  return (
    <AdminShell
      nav={nav}
      email={me.email}
      adminCode={me.adminCode}
      isSuper={me.isSuperAdmin}
    >
      {children}
    </AdminShell>
  );
}

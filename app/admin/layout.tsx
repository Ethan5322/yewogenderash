import {
  currentAdmin,
  hasPermission,
  type AdminPermission,
} from "@/lib/admin/permissions";
import { db } from "@/lib/db";
import { adminUnreadTotal } from "@/lib/messages";
import { staffUnreadTotal } from "@/lib/admin/staffMessages";
import {
  AdminShell,
  type AdminNavGroup,
  type AdminNavItem,
  type AdminAlert,
} from "@/components/admin/admin-shell";

type NavDef = AdminNavItem & {
  perm?: AdminPermission;
  anyPerm?: AdminPermission[];
  superOnly?: boolean;
};
type GroupDef = { label: string; items: NavDef[] };

/**
 * Corporate module map. Each item declares the capability it needs; the sidebar
 * only renders sections this admin is authorised for. Grouped like a finance
 * back office (Operations / Finance / Content / Governance).
 */
const NAV_GROUPS: GroupDef[] = [
  {
    label: "Overview",
    items: [
      { href: "/admin", label: "Dashboard", key: "overview" },
      // No `perm`, on purpose. The staff line is open to every admin — a
      // sub-admin holding only `kyc` must still be able to answer the main
      // admin. The `messages` capability gates the FUNDRAISER line below
      // ("Notices"), which is a different table and a different page.
      { href: "/admin/team-chat", label: "Team chat", key: "teamchat" },
      { href: "/admin/id", label: "My staff ID", key: "staffid" },
      { href: "/admin/qr", label: "QR codes", key: "qr" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/admin/campaigns", label: "Campaigns", key: "campaigns", perm: "campaigns" },
      { href: "/admin/owners", label: "Owners / KYC", key: "kyc", perm: "kyc" },
      { href: "/admin/querycodes", label: "Querycodes / QR", key: "querycodes", perm: "campaigns" },
      { href: "/admin/messages", label: "Notices", key: "messages", perm: "messages" },
      { href: "/admin/notifications", label: "Notifications", key: "notifications", perm: "messages" },
      { href: "/admin/support", label: "Support / Disputes", key: "support", perm: "messages" },
    ],
  },
  {
    label: "Finance",
    items: [
      { href: "/admin/balances", label: "Fundraiser balances", key: "balances", perm: "payouts" },
      { href: "/admin/donations", label: "Donations", key: "donations", perm: "payouts" },
      { href: "/admin/payments", label: "Payments", key: "payments", perm: "payouts" },
      { href: "/admin/payouts", label: "Payouts", key: "payouts", perm: "payouts" },
      { href: "/admin/reports", label: "Reports", key: "reports", perm: "payouts" },
    ],
  },
  {
    label: "Content",
    items: [
      { href: "/admin/content", label: "CMS / Pages", key: "content", perm: "content" },
      { href: "/admin/blog", label: "Blog", key: "blog", perm: "content" },
    ],
  },
  {
    label: "Governance",
    items: [
      { href: "/admin/team", label: "Roles & Team", key: "admins", superOnly: true },
      { href: "/admin/audit", label: "Audit log", key: "audit", perm: "audit" },
      { href: "/admin/system", label: "System status", key: "system", superOnly: true },
      { href: "/admin/translations", label: "Translations", key: "translations", superOnly: true },
      { href: "/admin/settings", label: "Fees / Settings", key: "settings", superOnly: true },
    ],
  },
];

export const metadata = { title: "Admin" };

/**
 * Admin shell. Role and per-capability permissions are re-verified SERVER-SIDE
 * here on every request (currentAdmin loads fresh from the DB) — middleware/JWT
 * alone is never trusted for the financial control room. The sidebar and the
 * alert feed show only the sections this admin is allowed to use.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const me = await currentAdmin();
  const can = (item: NavDef) =>
    (item.superOnly ? me.isSuperAdmin : true) &&
    (!item.perm || hasPermission(me, item.perm)) &&
    (!item.anyPerm || item.anyPerm.some((p) => hasPermission(me, p)));

  const [pendingKyc, pendingCampaigns, pendingPayouts, unreadMessages, openSupport, unreadStaff] =
    await Promise.all([
      db.user.count({ where: { verificationStatus: "PENDING", ownerProfile: { isNot: null } } }),
      db.campaign.count({ where: { status: "PENDING_REVIEW" } }),
      db.payout.count({ where: { status: { in: ["REQUESTED", "APPROVED"] } } }),
      adminUnreadTotal(),
      db.supportMessage.count({ where: { status: "OPEN" } }),
      // Per-admin, unlike every other badge here: "staff messages addressed to
      // ME". A shared count would show one admin another's unread.
      staffUnreadTotal(me.id),
    ]);
  const badgeFor: Partial<Record<string, number>> = {
    kyc: pendingKyc,
    campaigns: pendingCampaigns,
    payouts: pendingPayouts,
    messages: unreadMessages,
    support: openSupport,
    teamchat: unreadStaff,
  };

  const groups: AdminNavGroup[] = NAV_GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((item) => can(item))
      .map(({ href, label, key }) => ({ href, label, key, badge: badgeFor[key] || undefined })),
  })).filter((g) => g.items.length > 0);

  // Alert feed (top-header bell) — only queues this admin can act on, non-zero.
  const alerts: AdminAlert[] = [
    { label: "KYC to review", href: "/admin/owners", count: pendingKyc, perm: "kyc" as const },
    { label: "Campaigns awaiting approval", href: "/admin/campaigns?status=PENDING_REVIEW", count: pendingCampaigns, perm: "campaigns" as const },
    { label: "Payouts to release", href: "/admin/payouts", count: pendingPayouts, perm: "payouts" as const },
    { label: "Unread messages", href: "/admin/messages", count: unreadMessages, perm: "messages" as const },
    { label: "Open support cases", href: "/admin/support", count: openSupport, perm: "messages" as const },
  ]
    .filter((a) => a.count > 0 && hasPermission(me, a.perm))
    .map(({ label, href, count }) => ({ label, href, count }));

  const roleLabel = me.isSuperAdmin ? "Super admin" : "Delegated admin";

  return (
    <AdminShell
      groups={groups}
      email={me.email}
      name={me.name}
      adminCode={me.adminCode}
      isSuper={me.isSuperAdmin}
      roleLabel={roleLabel}
      alerts={alerts}
    >
      {children}
    </AdminShell>
  );
}

import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * Delegated administration. A SUPER admin ("main admin") implicitly holds every
 * capability and can manage other admins. A sub-admin (role ADMIN, not super)
 * holds only the capabilities toggled on in their adminPermissions map.
 */
export const ADMIN_PERMISSIONS = {
  kyc: "Owner verification (KYC) review",
  campaigns: "Campaign review & decisions",
  payouts: "Payout approval & processing",
  content: "Site content editing",
  messages: "Fundraiser messages & notices",
  audit: "Audit log (read-only)",
  admins: "Manage admins & permissions",
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;
export const ADMIN_PERMISSION_KEYS = Object.keys(
  ADMIN_PERMISSIONS
) as AdminPermission[];

/**
 * Named role presets — a corporate label mapped onto the underlying capability
 * set. Storage stays the per-capability map (so custom mixes still work); these
 * are the standard bundles offered in the team UI and shown in the access
 * matrix. "Super admin" is separate (holds everything, manages admins).
 */
export const ROLE_PRESETS: {
  key: string;
  label: string;
  description: string;
  perms: AdminPermission[];
}[] = [
  { key: "compliance", label: "Compliance admin", description: "KYC & campaign review", perms: ["kyc", "campaigns"] },
  { key: "finance", label: "Finance admin", description: "Donations, payments & payouts", perms: ["payouts"] },
  { key: "support", label: "Support agent", description: "Messages, notices & disputes", perms: ["messages"] },
  { key: "content", label: "Content admin", description: "CMS pages & blog", perms: ["content"] },
  { key: "auditor", label: "Read-only auditor", description: "Audit log access only", perms: ["audit"] },
];

export type PermMap = Partial<Record<AdminPermission, boolean>>;

export function permsFrom(value: unknown): PermMap {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const out: PermMap = {};
    for (const k of ADMIN_PERMISSION_KEYS) {
      if ((value as Record<string, unknown>)[k] === true) out[k] = true;
    }
    return out;
  }
  return {};
}

type AdminUser = {
  id: string;
  isSuperAdmin: boolean;
  adminPermissions: unknown;
};

export function hasPermission(u: AdminUser, key: AdminPermission): boolean {
  if (u.isSuperAdmin) return true;
  return permsFrom(u.adminPermissions)[key] === true;
}

export type CurrentAdmin = {
  id: string;
  name: string;
  email: string;
  adminCode: string | null;
  isSuperAdmin: boolean;
  adminPermissions: unknown;
};

/**
 * The current admin, loaded FRESH from the DB — permissions must never be
 * trusted from a stale JWT. Redirects non-admins away.
 */
export async function currentAdmin(): Promise<CurrentAdmin> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/admin");
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      adminCode: true,
      isSuperAdmin: true,
      adminPermissions: true,
    },
  });
  if (!user || user.role !== "ADMIN") redirect("/");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    adminCode: user.adminCode,
    isSuperAdmin: user.isSuperAdmin,
    adminPermissions: user.adminPermissions,
  };
}

/**
 * Guard a specific capability for pages and server actions. Returns the admin
 * when allowed; redirects to the admin overview with a ?denied flag otherwise.
 */
export async function requirePermission(
  key: AdminPermission
): Promise<CurrentAdmin> {
  const admin = await currentAdmin();
  if (!hasPermission(admin, key)) redirect(`/admin?denied=${key}`);
  return admin;
}

/** Guard a page/action that any ONE of several capabilities may open. */
export async function requireAnyPermission(
  keys: AdminPermission[]
): Promise<CurrentAdmin> {
  const admin = await currentAdmin();
  if (!keys.some((k) => hasPermission(admin, k))) redirect(`/admin?denied=${keys[0]}`);
  return admin;
}

/**
 * Guard reserved for the main admin only — sensitive platform config (fee rate,
 * payout ceilings) is never delegable to a sub-admin. Redirects otherwise.
 */
export async function requireSuperAdmin(): Promise<CurrentAdmin> {
  const admin = await currentAdmin();
  if (!admin.isSuperAdmin) redirect("/admin?denied=super");
  return admin;
}

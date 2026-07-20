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
  admins: "Manage admins & permissions",
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;
export const ADMIN_PERMISSION_KEYS = Object.keys(
  ADMIN_PERMISSIONS
) as AdminPermission[];

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
      isSuperAdmin: true,
      adminPermissions: true,
    },
  });
  if (!user || user.role !== "ADMIN") redirect("/");
  return {
    id: user.id,
    name: user.name,
    email: user.email,
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

"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { generateUniqueAdminCode } from "@/lib/querycode";
import { writeAudit } from "@/lib/audit";
import {
  ADMIN_PERMISSION_KEYS,
  currentAdmin,
  requirePermission,
  type PermMap,
} from "@/lib/admin/permissions";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Read the permission checkboxes off a form into a clean map. */
function readPerms(formData: FormData): PermMap {
  const out: PermMap = {};
  for (const key of ADMIN_PERMISSION_KEYS) {
    if (formData.get(`perm_${key}`) != null) out[key] = true;
  }
  return out;
}

const createSchema = z.object({
  name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.email("Enter a valid email").max(190),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(100)
    .regex(/[a-zA-Z]/, "Must include a letter")
    .regex(/[0-9]/, "Must include a number"),
});

/** Create a new sub-admin with a chosen set of capabilities. */
export async function createSubAdminAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("admins");

  const parsed = createSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const email = parsed.data.email.toLowerCase().trim();
  const permissions = readPerms(formData);

  try {
    const created = await db.user.create({
      data: {
        name: parsed.data.name,
        email,
        passwordHash: await hashPassword(parsed.data.password),
        role: "ADMIN",
        isSuperAdmin: false,
        adminPermissions: permissions as Prisma.InputJsonValue,
        adminCode: await generateUniqueAdminCode(),
        emailVerifiedAt: new Date(),
      },
      select: { id: true },
    });
    await writeAudit({
      actorId: admin.id,
      action: "ADMIN_CREATED",
      entityType: "User",
      entityId: created.id,
      detail: { email, permissions },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "A user with this email already exists." };
    }
    console.error("[team] create sub-admin failed:", err);
    return { ok: false, error: "Could not create the admin. Please try again." };
  }

  revalidatePath("/admin/team");
  return { ok: true };
}

/** Update a sub-admin's capability toggles. Super admins can't be edited here. */
export async function updatePermissionsAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  const admin = await requirePermission("admins");
  const targetId = String(formData.get("targetId") ?? "");
  if (!targetId) return { ok: false, error: "Missing target" };

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { role: true, isSuperAdmin: true, email: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Admin not found." };
  }
  if (target.isSuperAdmin) {
    return { ok: false, error: "Super admins already hold every capability." };
  }

  const permissions = readPerms(formData);
  await db.user.update({
    where: { id: targetId },
    data: { adminPermissions: permissions as Prisma.InputJsonValue },
  });
  await writeAudit({
    actorId: admin.id,
    action: "ADMIN_PERMISSIONS_UPDATED",
    entityType: "User",
    entityId: targetId,
    detail: { email: target.email, permissions },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

/**
 * Grant or revoke the super-admin ("main admin") role. Only a super admin can
 * do this. Revoking is refused if it would leave zero super admins — including
 * a super admin stepping down only after another exists (the "be replaced"
 * flow: first promote a successor, then toggle yourself off).
 */
export async function setSuperAdminAction(
  targetId: string,
  makeSuper: boolean
): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin.isSuperAdmin) {
    return { ok: false, error: "Only a main (super) admin can change this." };
  }

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { role: true, isSuperAdmin: true, email: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Target must be an existing admin." };
  }

  if (!makeSuper && target.isSuperAdmin) {
    const supers = await db.user.count({ where: { role: "ADMIN", isSuperAdmin: true } });
    if (supers <= 1) {
      return {
        ok: false,
        error: "Promote another admin to main admin first — one must always remain.",
      };
    }
  }

  await db.user.update({
    where: { id: targetId },
    data: { isSuperAdmin: makeSuper },
  });
  await writeAudit({
    actorId: admin.id,
    action: makeSuper ? "ADMIN_PROMOTED_SUPER" : "ADMIN_DEMOTED_SUPER",
    entityType: "User",
    entityId: targetId,
    detail: { email: target.email },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

/** Revoke admin access entirely (demote to a normal account). */
export async function revokeAdminAction(targetId: string): Promise<ActionResult> {
  const admin = await currentAdmin();
  if (!admin.isSuperAdmin) {
    return { ok: false, error: "Only a main (super) admin can remove admins." };
  }
  if (targetId === admin.id) {
    return { ok: false, error: "You can't remove your own admin access." };
  }

  const target = await db.user.findUnique({
    where: { id: targetId },
    select: { role: true, isSuperAdmin: true, email: true, ownerProfile: { select: { id: true } } },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Admin not found." };
  }
  if (target.isSuperAdmin) {
    return { ok: false, error: "Step this main admin down before removing them." };
  }

  await db.user.update({
    where: { id: targetId },
    data: {
      role: target.ownerProfile ? "OWNER" : "DONOR",
      adminPermissions: {} as Prisma.InputJsonValue,
    },
  });
  await writeAudit({
    actorId: admin.id,
    action: "ADMIN_REVOKED",
    entityType: "User",
    entityId: targetId,
    detail: { email: target.email },
  });

  revalidatePath("/admin/team");
  return { ok: true };
}

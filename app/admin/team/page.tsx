import { db } from "@/lib/db";
import {
  ADMIN_PERMISSIONS,
  requirePermission,
  permsFrom,
} from "@/lib/admin/permissions";
import {
  CreateAdminForm,
  AdminRow,
  type AdminRowData,
} from "@/components/admin/team-manager";

export const metadata = { title: "Admin · Team" };

export default async function AdminTeamPage() {
  const me = await requirePermission("admins");

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      email: true,
      isSuperAdmin: true,
      adminPermissions: true,
    },
    orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "asc" }],
  });

  const permissionDefs = Object.entries(ADMIN_PERMISSIONS) as [string, string][];

  const rows: AdminRowData[] = admins.map((a) => ({
    id: a.id,
    name: a.name,
    email: a.email,
    isSuperAdmin: a.isSuperAdmin,
    permissions: permsFrom(a.adminPermissions) as Record<string, boolean>,
  }));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Admin team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Create sub-admins and grant each one only the capabilities they need.
          The main admin holds everything and can hand over the role.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6 shadow-sm">
        <h2 className="font-display text-base font-semibold">Add a sub-admin</h2>
        <p className="mb-4 mt-1 text-sm text-muted-foreground">
          Give them a temporary password to share securely; they can sign in
          immediately.
        </p>
        <CreateAdminForm permissionDefs={permissionDefs} />
      </section>

      <section>
        <h2 className="mb-3 font-display text-base font-semibold">
          Admins ({rows.length})
        </h2>
        <div className="space-y-4">
          {rows.map((row) => (
            <AdminRow
              key={row.id}
              admin={row}
              permissionDefs={permissionDefs}
              currentAdminId={me.id}
              currentIsSuper={me.isSuperAdmin}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

import { Check, Crown } from "lucide-react";
import { db } from "@/lib/db";
import {
  ADMIN_PERMISSIONS,
  ADMIN_PERMISSION_KEYS,
  ROLE_PRESETS,
  requirePermission,
  permsFrom,
  type AdminPermission,
} from "@/lib/admin/permissions";
import {
  CreateAdminForm,
  AdminRow,
  type AdminRowData,
} from "@/components/admin/team-manager";
import { PageHeader, SectionCard } from "@/components/admin/ui";

export const metadata = { title: "Admin · Roles & Team" };

export default async function AdminTeamPage() {
  const me = await requirePermission("admins");

  const admins = await db.user.findMany({
    where: { role: "ADMIN" },
    select: {
      id: true,
      name: true,
      email: true,
      adminCode: true,
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
    adminCode: a.adminCode,
    isSuperAdmin: a.isSuperAdmin,
    permissions: permsFrom(a.adminPermissions) as Record<string, boolean>,
  }));

  return (
    <div>
      <PageHeader
        title="Roles & Team"
        description="Create sub-admins and grant each one only the capabilities they need. The main admin holds everything and can hand over the role."
      />

      {/* Access matrix — standard roles × capabilities */}
      <SectionCard title="Access matrix" sub="Standard roles and the capabilities each bundle grants" className="mb-6" bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Role</th>
                {ADMIN_PERMISSION_KEYS.map((k) => (
                  <th key={k} className="px-3 py-3 text-center font-medium">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-4 py-2.5 font-medium">
                  <span className="inline-flex items-center gap-1.5">
                    <Crown className="h-3.5 w-3.5 text-gold" aria-hidden /> Super admin
                  </span>
                </td>
                {ADMIN_PERMISSION_KEYS.map((k) => (
                  <td key={k} className="px-3 py-2.5 text-center">
                    <Check className="mx-auto h-4 w-4 text-success" aria-hidden />
                  </td>
                ))}
              </tr>
              {ROLE_PRESETS.map((role) => (
                <tr key={role.key} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{role.label}</p>
                    <p className="text-xs text-muted-foreground">{role.description}</p>
                  </td>
                  {ADMIN_PERMISSION_KEYS.map((k) => (
                    <td key={k} className="px-3 py-2.5 text-center">
                      {role.perms.includes(k as AdminPermission) ? (
                        <Check className="mx-auto h-4 w-4 text-success" aria-hidden />
                      ) : (
                        <span className="text-muted-foreground/40">·</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="Add a sub-admin" sub="Give them a temporary password to share securely; they can sign in immediately." className="mb-6">
        <CreateAdminForm permissionDefs={permissionDefs} rolePresets={ROLE_PRESETS} />
      </SectionCard>

      <h2 className="mb-3 font-display text-base font-semibold">Admins ({rows.length})</h2>
      <div className="space-y-4">
        {rows.map((row) => (
          <AdminRow
            key={row.id}
            admin={row}
            permissionDefs={permissionDefs}
            rolePresets={ROLE_PRESETS}
            currentAdminId={me.id}
            currentIsSuper={me.isSuperAdmin}
          />
        ))}
      </div>
    </div>
  );
}

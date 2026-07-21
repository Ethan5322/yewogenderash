import { Search } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission } from "@/lib/admin/permissions";

export const metadata = { title: "Admin · Audit log" };

const dt = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function label(action: string) {
  return action
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function summarizeDetail(detail: unknown): string {
  if (!detail || typeof detail !== "object") return "";
  return Object.entries(detail as Record<string, unknown>)
    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(" · ")
    .slice(0, 160);
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("admins");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);

  const where: Prisma.AuditLogWhereInput = q
    ? {
        OR: [
          { action: { contains: q, mode: "insensitive" } },
          { entityType: { contains: q, mode: "insensitive" } },
          { actor: { name: { contains: q, mode: "insensitive" } } },
          { actor: { email: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const logs = await db.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 150,
    select: {
      id: true,
      action: true,
      entityType: true,
      entityId: true,
      detail: true,
      ipAddress: true,
      createdAt: true,
      actor: { select: { name: true, email: true } },
    },
  });

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Audit log</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Every consequential action on the platform, newest first. Append-only.
          </p>
        </div>
        <form action="/admin/audit" className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search action, actor, entity…"
            className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </form>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">When</th>
              <th className="px-4 py-3 font-medium">Actor</th>
              <th className="px-4 py-3 font-medium">Action</th>
              <th className="px-4 py-3 font-medium">Entity</th>
              <th className="px-4 py-3 font-medium">Detail</th>
              <th className="px-4 py-3 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No audit entries{q ? " match this search" : " yet"}.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id} className="border-b last:border-0 align-top hover:bg-accent/30">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {dt.format(l.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    {l.actor ? (
                      <>
                        <p className="font-medium">{l.actor.name}</p>
                        <p className="text-xs text-muted-foreground">{l.actor.email}</p>
                      </>
                    ) : (
                      <span className="text-muted-foreground">system</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">{label(l.action)}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {l.entityType ?? "—"}
                    {l.entityId ? (
                      <span className="block font-mono">{l.entityId.slice(0, 12)}…</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {summarizeDetail(l.detail) || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {l.ipAddress ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Showing the {logs.length} most recent entries.
      </p>
    </div>
  );
}

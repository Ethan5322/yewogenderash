import Link from "next/link";
import { Search, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { requirePermission, hasPermission } from "@/lib/admin/permissions";
import { Pager, pageFrom } from "@/components/admin/pager";
import { PageHeader } from "@/components/admin/ui";

const PAGE_SIZE = 75;

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

/** Map an audited entity to the admin screen that shows it, so every log line
 *  is a jump-off point instead of a dead id. */
function entityHref(type: string | null, id: string | null): string | null {
  if (!type) return null;
  switch (type) {
    case "Campaign":
      return id ? `/admin/campaigns/${id}` : "/admin/campaigns";
    case "CampaignOwner":
      return id ? `/admin/owners/${id}` : "/admin/owners";
    case "User":
      return "/admin/team";
    case "Payout":
      return "/admin/payouts";
    case "Donation":
      return "/admin/donations";
    case "SupportMessage":
      return "/admin/support";
    case "SiteContent":
      return "/admin/content";
    case "PlatformSettings":
      return "/admin/settings";
    default:
      return null;
  }
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
  const me = await requirePermission("audit");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 60);
  const page = pageFrom(sp.page);
  // ?actor=<userId> scopes the log to one staff member — this is how the main
  // admin reviews an individual sub-admin's activity from the team page.
  const actorId = typeof sp.actor === "string" ? sp.actor.trim().slice(0, 40) : "";

  const filters: Prisma.AuditLogWhereInput[] = [];
  if (actorId) filters.push({ actorId });

  // Who this admin is allowed to read about.
  //
  //   main admin            → everyone
  //   sub-admin + auditOthers → other delegated admins, and unattributed system
  //                             entries, but NEVER the main admin's actions
  //   sub-admin             → only their own actions
  //
  // Applied as an AND alongside any ?actor= filter, so a sub-admin who guesses
  // the main admin's id simply gets an empty log rather than a way around this.
  const canSeeOthers = hasPermission(me, "auditOthers");
  if (!me.isSuperAdmin) {
    if (canSeeOthers) {
      const mainAdmins = await db.user.findMany({
        where: { isSuperAdmin: true },
        select: { id: true },
      });
      const mainAdminIds = mainAdmins.map((u) => u.id);
      filters.push({
        OR: [
          { actorId: { notIn: mainAdminIds } },
          // Unattributed (system) entries name no admin, so they are nobody's
          // private activity — `notIn` would drop them, this keeps them.
          { actorId: null },
        ],
      });
    } else {
      filters.push({ actorId: me.id });
    }
  }
  if (q) {
    filters.push({
      OR: [
        { action: { contains: q, mode: "insensitive" } },
        { entityType: { contains: q, mode: "insensitive" } },
        { actor: { name: { contains: q, mode: "insensitive" } } },
        { actor: { email: { contains: q, mode: "insensitive" } } },
      ],
    });
  }
  const where: Prisma.AuditLogWhereInput = filters.length ? { AND: filters } : {};

  const actorRow = actorId
    ? await db.user.findUnique({
        where: { id: actorId },
        select: { id: true, name: true, email: true, adminCode: true, isSuperAdmin: true },
      })
    : null;
  // The heading names whoever is being filtered on, so it has to obey the same
  // rule as the rows — otherwise "Activity · <main admin>" would leak the name
  // above an empty table.
  const mayNameActor =
    !actorRow ||
    me.isSuperAdmin ||
    actorRow.id === me.id ||
    (canSeeOthers && !actorRow.isSuperAdmin);
  const actor = mayNameActor ? actorRow : null;

  const [logs, matchCount] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    db.auditLog.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title={actor ? `Activity · ${actor.name}` : "Audit log"}
        description={
          actor
            ? `Every action recorded for ${actor.email}${actor.adminCode ? ` (${actor.adminCode})` : ""} — ${actor.isSuperAdmin ? "main admin" : "delegated admin"}.`
            : "Every consequential action on the platform, newest first. Append-only."
        }
        actions={
          <form action="/admin/audit" className="relative">
            {/* Keep the actor scope when searching within one staff member. */}
            {actorId ? <input type="hidden" name="actor" value={actorId} /> : null}
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input
              name="q"
              defaultValue={q}
              placeholder="Search action, actor, entity…"
              className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </form>
        }
      />

      {actor ? (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
          <span className="font-medium">
            Showing one staff member&apos;s activity ({matchCount} entr
            {matchCount === 1 ? "y" : "ies"}).
          </span>
          <Link href="/admin/audit" className="font-medium text-primary hover:underline">
            View the whole log
          </Link>
        </div>
      ) : null}

      {/* Say plainly what this admin is looking at, so a short log never reads
          as a missing one. */}
      {!me.isSuperAdmin ? (
        <p className="mb-4 rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
          {canSeeOthers
            ? "You can see your own activity and that of other delegated admins. The main admin's activity is not shown."
            : "You can see your own activity. Ask the main admin if you need visibility of other admins."}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
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
                    {(() => {
                      const href = entityHref(l.entityType, l.entityId);
                      const body = (
                        <>
                          {l.entityType ?? "—"}
                          {l.entityId ? (
                            <span className="block font-mono">
                              {l.entityId.slice(0, 12)}…
                            </span>
                          ) : null}
                        </>
                      );
                      return href ? (
                        <Link
                          href={href}
                          className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                          title={`Open ${l.entityType}`}
                        >
                          <span>{body}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                        </Link>
                      ) : (
                        body
                      );
                    })()}
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

      <Pager
        basePath="/admin/audit"
        baseParams={{ q: q || undefined, actor: actorId || undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

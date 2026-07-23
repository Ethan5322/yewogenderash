import Link from "next/link";
import { ChevronRight, Inbox, Megaphone } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { listAdminThreads } from "@/lib/messages";
import { BroadcastForm } from "@/components/admin/broadcast-form";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin · Messages" };

export default async function AdminMessagesPage() {
  await requirePermission("messages");
  const [threads, notices] = await Promise.all([
    listAdminThreads(),
    db.message.findMany({
      where: { isBroadcast: true },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, subject: true, createdAt: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Messages"
        description="Reply to individual fundraisers, or send one notice to everyone."
      />

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Inbox */}
        <section className="lg:col-span-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Inbox className="h-4 w-4" aria-hidden /> Fundraiser inbox
          </h2>
          {threads.length === 0 ? (
            <p className="mt-3 rounded-lg border bg-card p-5 text-sm text-muted-foreground">
              No fundraiser messages yet.
            </p>
          ) : (
            <ul className="mt-3 divide-y rounded-lg border bg-card">
              {threads.map((t) => (
                <li key={t.ownerId}>
                  <Link
                    href={`/admin/messages/${t.ownerId}`}
                    className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className="truncate font-medium">{t.name}</span>
                        {t.unread > 0 ? (
                          <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                            {t.unread} new
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                        {t.lastBody}
                      </span>
                      <span className="mt-0.5 block text-xs text-muted-foreground/70">
                        {formatDateTime(t.lastAt)}
                        {t.authorCode ? ` · ${t.authorCode}` : ""}
                      </span>
                    </span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Broadcast composer */}
        <section>
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Megaphone className="h-4 w-4" aria-hidden /> Notice to all fundraisers
          </h2>
          <div className="mt-3 rounded-lg border bg-card p-5 shadow-sm">
            <BroadcastForm />
          </div>
          {notices.length > 0 ? (
            <div className="mt-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Recent notices
              </p>
              <ul className="mt-2 space-y-1.5 text-sm">
                {notices.map((n) => (
                  <li key={n.id} className="flex justify-between gap-3">
                    <span className="truncate">{n.subject}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDateTime(n.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

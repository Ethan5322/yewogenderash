import Link from "next/link";
import { AlertTriangle, Mail } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { SupportResolveButton } from "@/components/admin/support-controls";
import { PageHeader } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Support" };

const FILTERS = [
  { value: "OPEN", label: "Open" },
  { value: "REPORT", label: "Abuse reports" },
  { value: "CONTACT", label: "Contact" },
  { value: "ALL", label: "All" },
] as const;

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("messages");
  const sp = await searchParams;
  const f = (typeof sp.f === "string" ? sp.f : "OPEN") as string;

  const where =
    f === "REPORT"
      ? { type: "REPORT" }
      : f === "CONTACT"
        ? { type: "CONTACT" }
        : f === "ALL"
          ? {}
          : { status: "OPEN" };

  const messages = await db.supportMessage.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Support inbox"
        description="Contact messages and abuse reports from the public site."
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((x) => (
          <Link
            key={x.value}
            href={`/admin/support?f=${x.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              f === x.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {x.label}
          </Link>
        ))}
      </div>

      {messages.length === 0 ? (
        <p className="mt-6 rounded-lg border bg-card p-8 text-center text-muted-foreground">
          Nothing here.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "rounded-xl border bg-card p-5 shadow-sm",
                m.status === "OPEN" && m.type === "REPORT" && "border-destructive/40"
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
                        m.type === "REPORT"
                          ? "bg-destructive/10 text-destructive"
                          : "bg-secondary text-secondary-foreground"
                      )}
                    >
                      {m.type === "REPORT" ? (
                        <AlertTriangle className="h-3 w-3" aria-hidden />
                      ) : (
                        <Mail className="h-3 w-3" aria-hidden />
                      )}
                      {m.type === "REPORT" ? "Report" : "Contact"}
                    </span>
                    <span className="text-sm font-medium">{m.name}</span>
                    <a href={`mailto:${m.email}`} className="text-sm text-primary hover:underline">
                      {m.email}
                    </a>
                    {m.status === "RESOLVED" ? (
                      <span className="text-xs font-semibold text-success">✓ Resolved</span>
                    ) : null}
                  </div>
                  {m.reason || m.code ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.reason ? `Reason: ${m.reason}` : ""}
                      {m.reason && m.code ? " · " : ""}
                      {m.code ? `Campaign: ${m.code}` : ""}
                    </p>
                  ) : null}
                  <p className="mt-2 whitespace-pre-line text-sm text-foreground/90">{m.message}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</p>
                </div>
                <SupportResolveButton id={m.id} status={m.status} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

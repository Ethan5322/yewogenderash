import { db } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/admin/permissions";
import { emailConfigured } from "@/lib/email";
import { optionalEnv } from "@/lib/env";
import { DashboardToolbar } from "@/components/admin/dashboard-toolbar";
import { PageHeader, SectionCard, Chip, type Tone } from "@/components/admin/ui";

export const metadata = { title: "Admin · System status" };
export const dynamic = "force-dynamic";

function envSet(name: string): boolean {
  return Boolean(process.env[name]);
}

function pctLabel(numerator: number, denominator: number): string {
  if (denominator <= 0) return "n/a";
  return `${Math.round((numerator / denominator) * 1000) / 10}%`;
}

export default async function AdminSystemPage() {
  await requireSuperAdmin();

  // DB health — time a trivial query.
  let dbOk = true;
  let dbMs = 0;
  try {
    const t = Date.now();
    await db.$queryRaw`SELECT 1`;
    dbMs = Date.now() - t;
  } catch {
    dbOk = false;
  }

  const [webhookTotal, webhookBadSig, webhookProcessed, notifTotal, notifSent, notifFailed] =
    await Promise.all([
      db.webhookEvent.count(),
      db.webhookEvent.count({ where: { signatureOk: false } }),
      db.webhookEvent.count({ where: { processedAt: { not: null } } }),
      db.notification.count(),
      db.notification.count({ where: { status: "SENT" } }),
      db.notification.count({ where: { status: "FAILED" } }),
    ]);

  const services: { label: string; ok: boolean; detail: string }[] = [
    { label: "Database", ok: dbOk, detail: dbOk ? `Responding · ${dbMs} ms` : "Unreachable" },
    {
      label: "Payment gateway (Chapa)",
      ok: envSet("CHAPA_SECRET_KEY"),
      detail: envSet("CHAPA_SECRET_KEY") ? "Key configured" : "CHAPA_SECRET_KEY missing",
    },
    {
      label: "Webhook signing",
      ok: envSet("CHAPA_WEBHOOK_SECRET"),
      detail: envSet("CHAPA_WEBHOOK_SECRET") ? "Secret configured" : "CHAPA_WEBHOOK_SECRET missing",
    },
    {
      label: "Email delivery (Resend)",
      ok: emailConfigured(),
      detail: emailConfigured() ? "Configured" : "Not configured (console fallback)",
    },
    {
      label: "WhatsApp admin alerts",
      ok: Boolean(optionalEnv("ADMIN_CALLMEBOT_APIKEY") && optionalEnv("ADMIN_WHATSAPP_PHONE")),
      detail:
        optionalEnv("ADMIN_CALLMEBOT_APIKEY") && optionalEnv("ADMIN_WHATSAPP_PHONE")
          ? "Configured"
          : "Optional — not configured",
    },
    {
      label: "File storage (Supabase)",
      ok: envSet("SUPABASE_SERVICE_ROLE_KEY") && envSet("NEXT_PUBLIC_SUPABASE_URL"),
      detail:
        envSet("SUPABASE_SERVICE_ROLE_KEY") && envSet("NEXT_PUBLIC_SUPABASE_URL")
          ? "Configured"
          : "Supabase keys missing",
    },
  ];

  const metrics: { label: string; value: string; tone: Tone }[] = [
    {
      label: "Webhook signature pass rate",
      value: pctLabel(webhookTotal - webhookBadSig, webhookTotal),
      tone: webhookBadSig > 0 ? "warning" : "success",
    },
    {
      label: "Webhooks processed",
      value: `${webhookProcessed} / ${webhookTotal}`,
      tone: "info",
    },
    {
      label: "Notification delivery rate",
      value: pctLabel(notifSent, notifTotal),
      tone: notifFailed > 0 ? "warning" : "success",
    },
    {
      label: "Failed notifications",
      value: String(notifFailed),
      tone: notifFailed > 0 ? "danger" : "neutral",
    },
  ];

  return (
    <div>
      <PageHeader
        title="System status"
        description="Live health of the platform's core services and integrations."
        actions={<DashboardToolbar />}
      />

      <SectionCard title="Services" className="mb-4" bodyClassName="p-0">
        <ul className="divide-y">
          {services.map((s) => (
            <li key={s.label} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2.5">
                <span
                  className={`inline-block h-2.5 w-2.5 rounded-full ${s.ok ? "bg-success" : "bg-destructive"}`}
                  aria-hidden
                />
                <span className="text-sm font-medium">{s.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground">{s.detail}</span>
                <Chip tone={s.ok ? "success" : "danger"}>{s.ok ? "Operational" : "Down"}</Chip>
              </div>
            </li>
          ))}
        </ul>
      </SectionCard>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {m.label}
            </p>
            <p className="mt-2 font-display text-xl font-bold">{m.value}</p>
            <Chip tone={m.tone} className="mt-2">
              {m.tone === "success" ? "Healthy" : m.tone === "danger" ? "Attention" : m.tone === "warning" ? "Watch" : "Info"}
            </Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

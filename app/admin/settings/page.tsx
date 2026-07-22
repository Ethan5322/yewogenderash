import { requireSuperAdmin } from "@/lib/admin/permissions";
import { getPlatformSettings } from "@/lib/settings";
import { emailConfigured } from "@/lib/email";
import { optionalEnv } from "@/lib/env";
import { SettingsForm } from "@/components/admin/settings-form";
import { PageHeader, SectionCard, Chip } from "@/components/admin/ui";

export const metadata = { title: "Admin · Fees / Settings" };
export const dynamic = "force-dynamic";

function envSet(name: string): boolean {
  return Boolean(process.env[name]);
}

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const { feeRate, autoApproveMaxEtb, minPayoutEtb } = await getPlatformSettings();
  const feePercent = Math.round(feeRate * 100000) / 1000; // rate → %, tidy

  const env: { label: string; ok: boolean; note: string }[] = [
    { label: "Payment gateway key", ok: envSet("CHAPA_SECRET_KEY"), note: "CHAPA_SECRET_KEY" },
    { label: "Webhook secret", ok: envSet("CHAPA_WEBHOOK_SECRET"), note: "CHAPA_WEBHOOK_SECRET" },
    { label: "Email (Resend)", ok: emailConfigured(), note: "RESEND_API_KEY" },
    { label: "File storage (Supabase)", ok: envSet("SUPABASE_SERVICE_ROLE_KEY"), note: "SUPABASE_SERVICE_ROLE_KEY" },
    { label: "Auth secret", ok: envSet("AUTH_SECRET"), note: "AUTH_SECRET" },
    {
      label: "WhatsApp alerts (optional)",
      ok: Boolean(optionalEnv("ADMIN_CALLMEBOT_APIKEY")),
      note: "ADMIN_CALLMEBOT_APIKEY",
    },
  ];

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Fees / Settings"
        description="Platform-wide financial policy. Only the main admin can change these, and every change is recorded in the audit log."
      />

      <SectionCard title="Financial policy" className="mb-6">
        <SettingsForm
          feePercent={feePercent}
          autoApproveMaxEtb={autoApproveMaxEtb}
          minPayoutEtb={minPayoutEtb}
        />
      </SectionCard>

      <SectionCard
        title="Environment & integrations"
        sub="Read-only status of the keys this deployment needs. Secrets live in server env, never in the database."
        bodyClassName="p-0"
      >
        <ul className="divide-y">
          {env.map((e) => (
            <li key={e.note} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{e.label}</p>
                <p className="font-mono text-xs text-muted-foreground">{e.note}</p>
              </div>
              <Chip tone={e.ok ? "success" : "warning"}>
                {e.ok ? "Configured" : "Missing"}
              </Chip>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
}

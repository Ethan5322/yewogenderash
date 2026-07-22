import { requireSuperAdmin } from "@/lib/admin/permissions";
import { getPlatformSettings } from "@/lib/settings";
import { SettingsForm } from "@/components/admin/settings-form";

export const metadata = { title: "Admin · Settings" };

export default async function AdminSettingsPage() {
  await requireSuperAdmin();
  const { feeRate, autoApproveMaxEtb } = await getPlatformSettings();
  const feePercent = Math.round(feeRate * 100000) / 1000; // rate → %, tidy

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Platform-wide financial policy. Only the main admin can change these, and
        every change is recorded in the audit log.
      </p>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <SettingsForm feePercent={feePercent} autoApproveMaxEtb={autoApproveMaxEtb} />
      </div>
    </div>
  );
}

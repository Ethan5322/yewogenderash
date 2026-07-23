import { Globe, ShieldCheck, Download } from "lucide-react";
import { currentAdmin } from "@/lib/admin/permissions";
import { appUrl } from "@/lib/env";
import { PageHeader, SectionCard } from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/copy-button";

export const metadata = { title: "Admin · QR codes" };
export const dynamic = "force-dynamic";

export default async function AdminQrPage() {
  await currentAdmin();
  const base = appUrl();

  const codes = [
    {
      key: "site" as const,
      icon: Globe,
      title: "Public site",
      desc: "Scan to open the Yewogen Derash homepage. Print it on posters, flyers, and shop counters so anyone can reach your campaigns.",
      url: base,
      tone: "text-primary",
    },
    {
      key: "admin" as const,
      icon: ShieldCheck,
      title: "Admin panel",
      desc: "Scan to open the staff sign-in (2FA required). For your team's phones and internal use only — do not share publicly.",
      url: `${base}/admin-login`,
      tone: "text-warning",
    },
  ];

  return (
    <div>
      <PageHeader
        title="QR codes"
        description="Two scannable entry points — one for the public site, one for the admin panel. Download the PNGs to print or share."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {codes.map((c) => (
          <SectionCard key={c.key} title={c.title}>
            <div className="flex flex-col items-center gap-4">
              <div className="rounded-xl border bg-white p-3 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element -- dynamic PNG route */}
                <img
                  src={`/api/qr?target=${c.key}`}
                  alt={`${c.title} QR code`}
                  width={200}
                  height={200}
                  className="h-48 w-48"
                />
              </div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <c.icon className={`h-4 w-4 ${c.tone}`} aria-hidden /> {c.title}
              </p>
              <p className="text-center text-xs text-muted-foreground">{c.desc}</p>
              <code className="w-full truncate rounded-md border bg-background px-3 py-2 text-center text-xs">
                {c.url}
              </code>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <CopyButton value={c.url} label="Copy link" />
                <a
                  href={`/api/qr?target=${c.key}&download=1`}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                >
                  <Download className="h-3.5 w-3.5" aria-hidden /> Download PNG
                </a>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
    </div>
  );
}

import { CheckCircle2, XCircle } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin · Payments" };

/**
 * Gateway (Chapa) webhook events — every callback is stored before processing
 * for idempotency, replay protection, and audit (brief §10.2 / §12.4). Signature
 * verification and outcome are shown so finance can reconcile against Chapa.
 */
export default async function AdminPaymentsPage() {
  await requirePermission("payouts");

  const [events, counts] = await Promise.all([
    db.webhookEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true, provider: true, externalRef: true, signatureOk: true,
        outcome: true, processedAt: true, createdAt: true,
      },
    }),
    db.webhookEvent.aggregate({ _count: true }),
  ]);
  const badSig = events.filter((e) => !e.signatureOk).length;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Payments &amp; gateway</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Chapa webhook events, stored on arrival for idempotency and audit. Every
        payment is verified against the gateway before a donation counts.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Tile label="Webhook events (total)" value={String(counts._count)} />
        <Tile label="Shown (recent)" value={String(events.length)} />
        <Tile label="Bad signature (recent)" value={String(badSig)} danger={badSig > 0} />
      </div>

      <div className="mt-5 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Received</th>
              <th className="px-4 py-3 font-medium">Provider</th>
              <th className="px-4 py-3 font-medium">Reference</th>
              <th className="px-4 py-3 font-medium">Signature</th>
              <th className="px-4 py-3 font-medium">Processed</th>
              <th className="px-4 py-3 font-medium">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No webhook events yet. In local dev, Chapa can&apos;t reach
                  localhost — settlement uses the verify-endpoint fallback.
                </td>
              </tr>
            ) : (
              events.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDateTime(e.createdAt)}</td>
                  <td className="px-4 py-3 capitalize">{e.provider}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{e.externalRef}</td>
                  <td className="px-4 py-3">
                    {e.signatureOk ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> valid</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><XCircle className="h-3.5 w-3.5" aria-hidden /> invalid</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{e.processedAt ? formatDateTime(e.processedAt) : "—"}</td>
                  <td className="px-4 py-3 text-xs">{e.outcome ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 font-display text-lg font-bold ${danger ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}

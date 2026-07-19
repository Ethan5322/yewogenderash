import Link from "next/link";
import type { VerificationStatus } from "@prisma/client";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Owner KYC" };

const FILTERS: { value: VerificationStatus | "ALL"; label: string }[] = [
  { value: "PENDING", label: "Awaiting review" },
  { value: "VERIFIED", label: "Verified" },
  { value: "RESUBMIT", label: "Resubmission requested" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All owners" },
];
const VALID = new Set(FILTERS.map((f) => f.value));

export default async function AdminOwnersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "PENDING";
  const status = (VALID.has(raw as VerificationStatus | "ALL") ? raw : "PENDING") as
    | VerificationStatus
    | "ALL";

  const owners = await db.campaignOwner.findMany({
    where: status === "ALL" ? {} : { user: { verificationStatus: status } },
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      biometricStatus: true,
      mulesooVerified: true,
      authorCode: true,
      updatedAt: true,
      user: {
        select: { name: true, email: true, phone: true, verificationStatus: true },
      },
      _count: { select: { documents: true, campaigns: true } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">
        Owner verification (KYC)
      </h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/owners?status=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              status === f.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">KYC status</th>
              <th className="px-4 py-3 font-medium">Biometric</th>
              <th className="px-4 py-3 font-medium">Docs</th>
              <th className="px-4 py-3 font-medium">Campaigns</th>
              <th className="px-4 py-3 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {owners.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No owners match this filter.
                </td>
              </tr>
            ) : (
              owners.map((o) => (
                <tr key={o.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/owners/${o.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {o.mulesooVerified ? (
                          <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden />
                        ) : null}
                        {o.user.name}
                      </span>
                    </Link>
                    <p className="text-xs text-muted-foreground">{o.user.email}</p>
                  </td>
                  <td className="px-4 py-3">{o.user.verificationStatus}</td>
                  <td className="px-4 py-3">{o.biometricStatus}</td>
                  <td className="px-4 py-3">{o._count.documents}</td>
                  <td className="px-4 py-3">{o._count.campaigns}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(o.updatedAt)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

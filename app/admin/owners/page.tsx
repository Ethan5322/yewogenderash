import Link from "next/link";
import type { VerificationStatus } from "@prisma/client";
import { ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  StatusChip,
  TableFrame,
  Thead,
  Th,
  EmptyRow,
} from "@/components/admin/ui";
import { Pager, pageFrom } from "@/components/admin/pager";

export const metadata = { title: "Admin · Owner KYC" };

const PAGE_SIZE = 50;

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
  await requirePermission("kyc");
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "PENDING";
  const status = (VALID.has(raw as VerificationStatus | "ALL") ? raw : "PENDING") as
    | VerificationStatus
    | "ALL";
  const page = pageFrom(sp.page);
  const where = status === "ALL" ? {} : { user: { verificationStatus: status } };

  const [owners, matchCount] = await Promise.all([
    db.campaignOwner.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    db.campaignOwner.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Owners / KYC"
        description="Identity and biometric verification for every fundraiser before their campaigns can go public."
      />

      <div className="mb-4 flex flex-wrap gap-2">
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

      <TableFrame minWidth={820}>
        <Thead>
          <Th>Owner</Th>
          <Th>Contact</Th>
          <Th>KYC status</Th>
          <Th>Biometric</Th>
          <Th>Docs</Th>
          <Th>Campaigns</Th>
          <Th>Updated</Th>
        </Thead>
        <tbody>
          {owners.length === 0 ? (
            <EmptyRow colSpan={7}>No owners match this filter.</EmptyRow>
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
                  {o.authorCode ? (
                    <p className="font-mono text-xs text-muted-foreground">{o.authorCode}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{o.user.email}</p>
                  <p className="text-xs text-muted-foreground">{o.user.phone ?? "—"}</p>
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={o.user.verificationStatus} />
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={o.biometricStatus} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{o._count.documents}</td>
                <td className="px-4 py-3 text-muted-foreground">{o._count.campaigns}</td>
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatDate(o.updatedAt)}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>

      <Pager
        basePath="/admin/owners"
        baseParams={{ status }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

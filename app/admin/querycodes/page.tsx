import Link from "next/link";
import { QrCode, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { appUrl } from "@/lib/env";
import { formatETB } from "@/lib/format";
import {
  PageHeader,
  StatusChip,
  Chip,
  TableFrame,
  Thead,
  Th,
  EmptyRow,
} from "@/components/admin/ui";
import { CopyButton } from "@/components/admin/copy-button";
import { Pager, pageFrom } from "@/components/admin/pager";

export const metadata = { title: "Admin · Querycodes" };

const PAGE_SIZE = 50;

/**
 * Querycode / QR registry. One campaign ↔ one querycode (enforced by a unique
 * column on the campaign). QR encodes {appUrl}/q/{queryCode}.
 */
export default async function AdminQuerycodesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("campaigns");
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);
  const page = pageFrom(sp.page);
  const base = appUrl();

  const where = q
    ? {
        OR: [
          { title: { contains: q, mode: "insensitive" as const } },
          { queryCode: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [rows, matchCount] = await Promise.all([
    db.campaign.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        queryCode: true,
        currentAmount: true,
        _count: { select: { donations: true } },
      },
    }),
    db.campaign.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Querycodes / QR"
        description="One campaign, one querycode — never shared. QR codes route to the quick-donate landing page."
        actions={
          <form action="/admin/querycodes" className="relative">
            <input
              name="q"
              defaultValue={q}
              placeholder="Campaign or querycode…"
              className="h-9 w-56 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </form>
        }
      />

      <TableFrame minWidth={900}>
        <Thead>
          <Th>Campaign</Th>
          <Th>Querycode</Th>
          <Th>Status</Th>
          <Th>Donations</Th>
          <Th>Raised</Th>
          <Th className="text-right">Actions</Th>
        </Thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={6}>No querycodes match.</EmptyRow>
          ) : (
            rows.map((c) => {
              const donateUrl = `${base}/q/${c.queryCode}`;
              const active = c.status === "ACTIVE";
              return (
                <tr key={c.id} className="border-b align-middle last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-primary hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm">{c.queryCode}</span>
                  </td>
                  <td className="px-4 py-3">
                    {active ? (
                      <Chip tone="success">Active</Chip>
                    ) : (
                      <span className="inline-flex items-center gap-1.5">
                        <Chip tone="neutral">Inactive</Chip>
                        <StatusChip status={c.status} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c._count.donations}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {formatETB(Number(c.currentAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <CopyButton value={donateUrl} label="Copy link" />
                      <Link
                        href={`/q/${c.queryCode}/qr`}
                        target="_blank"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                      >
                        <QrCode className="h-3.5 w-3.5" aria-hidden /> QR
                      </Link>
                      <Link
                        href={`/q/${c.queryCode}`}
                        target="_blank"
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
                      >
                        <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Landing
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </TableFrame>

      <Pager
        basePath="/admin/querycodes"
        baseParams={{ q: q || undefined }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

import Link from "next/link";
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
import { QuerycodeControls } from "@/components/admin/querycode-controls";
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
        queryCodeActive: true,
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
              const live = c.status === "ACTIVE" && c.queryCodeActive;
              return (
                <tr key={c.id} className="border-b align-middle last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-primary hover:underline">
                      {c.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`font-mono text-sm ${c.queryCodeActive ? "" : "text-muted-foreground line-through"}`}>
                      {c.queryCode}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      {!c.queryCodeActive ? (
                        <Chip tone="danger">Disabled</Chip>
                      ) : live ? (
                        <Chip tone="success">Live</Chip>
                      ) : (
                        <Chip tone="neutral">Enabled</Chip>
                      )}
                      {c.status !== "ACTIVE" ? <StatusChip status={c.status} /> : null}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{c._count.donations}</td>
                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {formatETB(Number(c.currentAmount))}
                  </td>
                  <td className="px-4 py-3">
                    <QuerycodeControls
                      campaignId={c.id}
                      queryCode={c.queryCode}
                      active={c.queryCodeActive}
                      donateUrl={donateUrl}
                    />
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

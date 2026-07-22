import Link from "next/link";
import type { NotificationStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  StatusChip,
  Chip,
  TableFrame,
  Thead,
  Th,
  EmptyRow,
} from "@/components/admin/ui";
import { Pager, pageFrom } from "@/components/admin/pager";

export const metadata = { title: "Admin · Notifications" };

const PAGE_SIZE = 50;

const FILTERS: { value: NotificationStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "SENT", label: "Sent" },
  { value: "QUEUED", label: "Queued" },
  { value: "FAILED", label: "Failed" },
];
const VALID = new Set(FILTERS.map((f) => f.value));

/** Outbound alert log (WhatsApp / email / SMS) to fundraisers. */
export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("messages");
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "ALL";
  const status = (VALID.has(raw as NotificationStatus | "ALL") ? raw : "ALL") as
    | NotificationStatus
    | "ALL";
  const page = pageFrom(sp.page);
  const where = status === "ALL" ? {} : { status };

  const [rows, matchCount, statusCounts] = await Promise.all([
    db.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true, channel: true, message: true, status: true, error: true,
        sentAt: true, createdAt: true,
        owner: { select: { user: { select: { name: true } } } },
        campaign: { select: { id: true, title: true } },
      },
    }),
    db.notification.count({ where }),
    db.notification.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);

  const countFor = (s: NotificationStatus) =>
    statusCounts.find((c) => c.status === s)?._count._all ?? 0;

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Every outbound alert to fundraisers — delivery status, channel and content."
        actions={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Chip tone="success">{countFor("SENT")} sent</Chip>
            <Chip tone="warning">{countFor("QUEUED")} queued</Chip>
            <Chip tone="danger">{countFor("FAILED")} failed</Chip>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/notifications?status=${f.value}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
              status === f.value
                ? "border-transparent bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <TableFrame minWidth={860}>
        <Thead>
          <Th>When</Th>
          <Th>Channel</Th>
          <Th>Recipient</Th>
          <Th>Message</Th>
          <Th>Status</Th>
        </Thead>
        <tbody>
          {rows.length === 0 ? (
            <EmptyRow colSpan={5}>No notifications match.</EmptyRow>
          ) : (
            rows.map((n) => (
              <tr key={n.id} className="border-b align-top last:border-0 hover:bg-accent/30">
                <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                  {formatDateTime(n.sentAt ?? n.createdAt)}
                </td>
                <td className="px-4 py-3">
                  <Chip tone="info">{n.channel}</Chip>
                </td>
                <td className="px-4 py-3">
                  <p className="text-sm">{n.owner?.user.name ?? "—"}</p>
                  {n.campaign ? (
                    <Link href={`/admin/campaigns/${n.campaign.id}`} className="text-xs text-muted-foreground hover:text-primary hover:underline">
                      {n.campaign.title}
                    </Link>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <p className="max-w-md truncate text-sm text-muted-foreground" title={n.message}>
                    {n.message}
                  </p>
                  {n.error ? (
                    <p className="text-xs text-destructive" title={n.error}>
                      {n.error.slice(0, 80)}
                    </p>
                  ) : null}
                </td>
                <td className="px-4 py-3"><StatusChip status={n.status} /></td>
              </tr>
            ))
          )}
        </tbody>
      </TableFrame>

      <Pager
        basePath="/admin/notifications"
        baseParams={{ status }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

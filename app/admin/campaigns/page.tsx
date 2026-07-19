import Link from "next/link";
import type { CampaignStatus } from "@prisma/client";
import { Star } from "lucide-react";
import { db } from "@/lib/db";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { formatETB, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Admin · Campaigns" };

const STATUS_FILTERS: { value: CampaignStatus | "ALL"; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PENDING_REVIEW", label: "Pending review" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ARCHIVED", label: "Archived" },
  { value: "DRAFT", label: "Drafts" },
];

const VALID_STATUSES = new Set(STATUS_FILTERS.map((f) => f.value));

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "ALL";
  const status = (VALID_STATUSES.has(raw as CampaignStatus | "ALL") ? raw : "ALL") as
    | CampaignStatus
    | "ALL";

  const campaigns = await db.campaign.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      category: true,
      targetAmount: true,
      currentAmount: true,
      currency: true,
      queryCode: true,
      isFeatured: true,
      createdAt: true,
      owner: { select: { user: { select: { name: true, email: true } } } },
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Campaigns</h1>

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={f.value === "ALL" ? "/admin/campaigns" : `/admin/campaigns?status=${f.value}`}
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
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Raised / target</th>
              <th className="px-4 py-3 font-medium">Querycode</th>
              <th className="px-4 py-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No campaigns match this filter.
                </td>
              </tr>
            ) : (
              campaigns.map((c) => (
                <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="font-medium text-foreground hover:text-primary hover:underline"
                    >
                      <span className="inline-flex items-center gap-1.5">
                        {c.isFeatured ? (
                          <Star className="h-3.5 w-3.5 fill-gold text-gold" aria-hidden />
                        ) : null}
                        {c.title}
                      </span>
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[c.category]}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{c.owner.user.name}</p>
                    <p className="text-xs text-muted-foreground">{c.owner.user.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatETB(Number(c.currentAmount), c.currency)}{" "}
                    <span className="text-muted-foreground">
                      / {formatETB(Number(c.targetAmount), c.currency)}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">{c.queryCode}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {formatDate(c.createdAt)}
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

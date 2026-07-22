import Link from "next/link";
import type { CampaignStatus, CampaignCategory, Prisma } from "@prisma/client";
import { Star, Search } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { formatETB, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/admin/ui";
import { Pager, pageFrom } from "@/components/admin/pager";

export const metadata = { title: "Admin · Campaigns" };

const PAGE_SIZE = 50;

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

const CATEGORY_FILTERS: { value: CampaignCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "All categories" },
  ...(Object.entries(CATEGORY_LABELS) as [CampaignCategory, string][]).map(
    ([value, label]) => ({ value, label })
  ),
];
const VALID_CATEGORIES = new Set(CATEGORY_FILTERS.map((f) => f.value));

type Filters = { status: string; category: string; q: string };

function hrefFor(base: Filters, over: Partial<Filters>): string {
  const m = { ...base, ...over };
  const sp = new URLSearchParams();
  if (m.status !== "ALL") sp.set("status", m.status);
  if (m.category !== "ALL") sp.set("category", m.category);
  if (m.q) sp.set("q", m.q);
  const qs = sp.toString();
  return qs ? `/admin/campaigns?${qs}` : "/admin/campaigns";
}

export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("campaigns");
  const sp = await searchParams;

  const rawStatus = typeof sp.status === "string" ? sp.status : "ALL";
  const status = (VALID_STATUSES.has(rawStatus as CampaignStatus | "ALL")
    ? rawStatus
    : "ALL") as CampaignStatus | "ALL";

  const rawCat = typeof sp.category === "string" ? sp.category : "ALL";
  const category = (VALID_CATEGORIES.has(rawCat as CampaignCategory | "ALL")
    ? rawCat
    : "ALL") as CampaignCategory | "ALL";

  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 100);
  const page = pageFrom(sp.page);
  const filters: Filters = { status, category, q };

  const where: Prisma.CampaignWhereInput = {};
  if (status !== "ALL") where.status = status;
  if (category !== "ALL") where.category = category;
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { queryCode: { contains: q, mode: "insensitive" } },
      { owner: { user: { name: { contains: q, mode: "insensitive" } } } },
      { owner: { user: { email: { contains: q, mode: "insensitive" } } } },
    ];
  }

  const [campaigns, matchCount] = await Promise.all([
    db.campaign.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
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
    }),
    db.campaign.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Every campaign from creation through approval to payout."
        actions={
          <form action="/admin/campaigns" className="flex items-center gap-2">
            {status !== "ALL" ? <input type="hidden" name="status" value={status} /> : null}
            {category !== "ALL" ? <input type="hidden" name="category" value={category} /> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <input
                name="q"
                defaultValue={q}
                placeholder="Search title, querycode, owner…"
                className="h-9 w-64 rounded-md border border-input bg-background pl-8 pr-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
            </div>
          </form>
        }
      />

      <div className="mt-4 flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={hrefFor(filters, { status: f.value })}
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

      <div className="mt-2 flex flex-wrap gap-2">
        {CATEGORY_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={hrefFor(filters, { category: f.value })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              category === f.value
                ? "border-transparent bg-secondary text-secondary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {q ? (
        <p className="mt-3 text-sm text-muted-foreground">
          {matchCount} result{matchCount === 1 ? "" : "s"} for
          &ldquo;{q}&rdquo; ·{" "}
          <Link href={hrefFor(filters, { q: "" })} className="text-primary hover:underline">
            clear search
          </Link>
        </p>
      ) : null}

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
                  No campaigns match these filters.
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

      <Pager
        basePath="/admin/campaigns"
        baseParams={{
          status: status === "ALL" ? undefined : status,
          category: category === "ALL" ? undefined : category,
          q: q || undefined,
        }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

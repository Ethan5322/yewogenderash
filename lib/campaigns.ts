import "server-only";
import type { CampaignCategory, CampaignStatus, Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { toNumber } from "@/lib/format";
import type { CampaignCard, CampaignSort } from "@/lib/campaign-types";

// Re-exported so existing server callers can keep importing from "@/lib/campaigns".
// Client components must import these from "@/lib/campaign-types" instead.
export { CATEGORY_LABELS } from "@/lib/campaign-types";
export type { CampaignCard, CampaignSort } from "@/lib/campaign-types";

// Statuses a member of the public is allowed to see. DRAFT / PENDING_REVIEW /
// SUSPENDED / REJECTED / ARCHIVED are never listed or reachable by slug.
export const PUBLIC_STATUSES: CampaignStatus[] = ["ACTIVE", "COMPLETED"];

const cardSelect = {
  id: true,
  title: true,
  slug: true,
  description: true,
  category: true,
  status: true,
  targetAmount: true,
  currentAmount: true,
  currency: true,
  queryCode: true,
  heroImageUrl: true,
  location: true,
  isFeatured: true,
  endDate: true,
  owner: {
    select: {
      authorCode: true,
      mulesooVerified: true,
      user: { select: { name: true } },
    },
  },
} satisfies Prisma.CampaignSelect;

type CampaignCardRow = Prisma.CampaignGetPayload<{ select: typeof cardSelect }>;

function toCard(c: CampaignCardRow): CampaignCard {
  return {
    id: c.id,
    title: c.title,
    slug: c.slug,
    description: c.description,
    category: c.category,
    status: c.status,
    targetAmount: toNumber(c.targetAmount),
    currentAmount: toNumber(c.currentAmount),
    currency: c.currency,
    queryCode: c.queryCode,
    heroImageUrl: c.heroImageUrl,
    location: c.location,
    isFeatured: c.isFeatured,
    endDate: c.endDate ? c.endDate.toISOString() : null,
    ownerName: c.owner.user.name,
    authorCode: c.owner.authorCode,
    mulesooVerified: c.owner.mulesooVerified,
  };
}

function orderBy(sort: CampaignSort): Prisma.CampaignOrderByWithRelationInput[] {
  switch (sort) {
    case "most_funded":
      return [{ currentAmount: "desc" }, { createdAt: "desc" }];
    case "ending_soon":
      return [{ endDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }];
    case "newest":
    default:
      return [{ createdAt: "desc" }];
  }
}

export type ListCampaignsParams = {
  category?: CampaignCategory;
  query?: string;
  sort?: CampaignSort;
};

/** Public campaign listing with optional category / text filters and sort. */
export async function listPublicCampaigns(
  params: ListCampaignsParams = {}
): Promise<CampaignCard[]> {
  const where: Prisma.CampaignWhereInput = {
    status: { in: PUBLIC_STATUSES },
    ...(params.category ? { category: params.category } : {}),
    ...(params.query
      ? {
          OR: [
            { title: { contains: params.query, mode: "insensitive" } },
            { description: { contains: params.query, mode: "insensitive" } },
            { location: { contains: params.query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const rows = await db.campaign.findMany({
    where,
    select: cardSelect,
    orderBy: orderBy(params.sort ?? "newest"),
    take: 60,
  });
  return rows.map(toCard);
}

/** Featured campaigns for the home page (falls back to newest active). */
export async function listFeaturedCampaigns(limit = 3): Promise<CampaignCard[]> {
  const rows = await db.campaign.findMany({
    where: { status: "ACTIVE", isFeatured: true },
    select: cardSelect,
    orderBy: [{ currentAmount: "desc" }],
    take: limit,
  });
  if (rows.length >= limit) return rows.map(toCard);

  // Top up with recent active campaigns so the section is never sparse.
  const extra = await db.campaign.findMany({
    where: { status: "ACTIVE", id: { notIn: rows.map((r) => r.id) } },
    select: cardSelect,
    orderBy: [{ createdAt: "desc" }],
    take: limit - rows.length,
  });
  return [...rows, ...extra].map(toCard);
}

export type CampaignUpdateItem = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
};

export type CampaignDetail = CampaignCard & {
  story: string | null;
  createdAt: string;
  reviewedAt: string | null;
  donationCount: number;
  supporterCount: number;
  updates: CampaignUpdateItem[];
};

/** Full public campaign by slug, or null if it doesn't exist / isn't public. */
export async function getPublicCampaignBySlug(
  slug: string
): Promise<CampaignDetail | null> {
  const c = await db.campaign.findFirst({
    where: { slug, status: { in: PUBLIC_STATUSES } },
    select: {
      ...cardSelect,
      story: true,
      createdAt: true,
      reviewedAt: true,
      updates: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, body: true, createdAt: true },
      },
      _count: { select: { donations: { where: { status: "SUCCESS" } } } },
    },
  });
  if (!c) return null;

  // Distinct successful supporters (anonymous donors collapse to null → one bucket).
  const supporterCount = await db.donation
    .groupBy({
      by: ["donorId"],
      where: { campaignId: c.id, status: "SUCCESS" },
    })
    .then((g) => g.length);

  return {
    ...toCard(c),
    story: c.story,
    createdAt: c.createdAt.toISOString(),
    reviewedAt: c.reviewedAt ? c.reviewedAt.toISOString() : null,
    donationCount: c._count.donations,
    supporterCount,
    updates: c.updates.map((u) => ({
      id: u.id,
      title: u.title,
      body: u.body,
      createdAt: u.createdAt.toISOString(),
    })),
  };
}

/** Resolve a querycode (QR / manual entry) to its one campaign, or null. */
export async function getPublicCampaignByQueryCode(
  queryCode: string
): Promise<CampaignCard | null> {
  const c = await db.campaign.findFirst({
    where: { queryCode, queryCodeActive: true, status: { in: PUBLIC_STATUSES } },
    select: cardSelect,
  });
  return c ? toCard(c) : null;
}

/** Lightweight slug → title/updates lookup for the updates subpage. */
export async function getCampaignUpdates(slug: string) {
  return db.campaign.findFirst({
    where: { slug, status: { in: PUBLIC_STATUSES } },
    select: {
      title: true,
      slug: true,
      updates: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, body: true, createdAt: true },
      },
    },
  });
}

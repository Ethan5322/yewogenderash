// Client-safe campaign constants & shapes. Kept separate from lib/campaigns.ts
// (which is `server-only` and imports Prisma) so client components can use these
// without pulling the database layer into the browser bundle.
import type { CampaignCategory, CampaignStatus } from "@prisma/client";

export const CATEGORY_LABELS: Record<CampaignCategory, string> = {
  MEDICAL: "Medical",
  EDUCATION: "Education",
  COMMUNITY: "Community",
  BUSINESS: "Business",
  EMERGENCY: "Emergency",
  OTHER: "Other",
};

export type CampaignSort = "newest" | "most_funded" | "ending_soon";

/** Plain, fully-serializable campaign shape for cards/lists (no Decimal). */
export type CampaignCard = {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: CampaignCategory;
  status: CampaignStatus;
  targetAmount: number;
  currentAmount: number;
  currency: string;
  queryCode: string;
  heroImageUrl: string | null;
  location: string | null;
  isFeatured: boolean;
  endDate: string | null;
  ownerName: string;
  authorCode: string | null;
  mulesooVerified: boolean;
};

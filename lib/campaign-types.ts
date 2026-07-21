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

/**
 * The proof document each campaign category must supply at creation (brief §6.1
 * step 7 / §6.2). `docType` is stored as the CampaignDocument.documentType; the
 * label/hint tell the fundraiser exactly which paper proves their specific cause
 * — the anti-fraud gate that ties evidence to each individual campaign.
 */
export const CATEGORY_PROOF: Record<
  CampaignCategory,
  { docType: string; label: string; hint: string }
> = {
  MEDICAL: {
    docType: "MEDICAL_LETTER",
    label: "Medical proof",
    hint: "Hospital letter, doctor letter, or treatment cost estimate.",
  },
  EDUCATION: {
    docType: "EDUCATION_LETTER",
    label: "Education proof",
    hint: "School letter, admission letter, or fee statement.",
  },
  COMMUNITY: {
    docType: "COMMUNITY_LETTER",
    label: "Community proof",
    hint: "NGO letter, local-authority letter, or project proof.",
  },
  BUSINESS: {
    docType: "BUSINESS_REGISTRATION",
    label: "Business proof",
    hint: "Business registration, tax/permit document, or cost estimate.",
  },
  EMERGENCY: {
    docType: "OTHER_SUPPORTING",
    label: "Emergency proof",
    hint: "Any official document evidencing the emergency.",
  },
  OTHER: {
    docType: "OTHER_SUPPORTING",
    label: "Supporting proof",
    hint: "An official document that supports your cause.",
  },
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

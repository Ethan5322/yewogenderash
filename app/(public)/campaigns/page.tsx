import type { Metadata } from "next";
import { SearchX } from "lucide-react";
import { CampaignCard } from "@/components/campaigns/campaign-card";
import { CampaignFilters } from "@/components/campaigns/campaign-filters";
import type { CampaignCategory } from "@prisma/client";
import {
  listPublicCampaigns,
  CATEGORY_LABELS,
  type CampaignSort,
} from "@/lib/campaigns";

export const metadata: Metadata = {
  title: "Browse campaigns",
  description:
    "Explore verified fundraising campaigns across Ethiopia. Every owner is identity-checked and every campaign has its own separated ledger.",
};

const VALID_CATEGORIES = new Set(Object.keys(CATEGORY_LABELS));
const VALID_SORTS = new Set(["newest", "most_funded", "ending_soon"]);

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const rawCategory = typeof sp.category === "string" ? sp.category : undefined;
  const rawSort = typeof sp.sort === "string" ? sp.sort : undefined;
  const query = typeof sp.q === "string" ? sp.q.trim() || undefined : undefined;

  const category =
    rawCategory && VALID_CATEGORIES.has(rawCategory)
      ? (rawCategory as CampaignCategory)
      : undefined;
  const sort =
    rawSort && VALID_SORTS.has(rawSort) ? (rawSort as CampaignSort) : "newest";

  const campaigns = await listPublicCampaigns({ category, query, sort });

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="mb-8">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Browse campaigns
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Every campaign here has a verified owner and its own separated ledger.
          Support the causes that matter — knowing exactly where your birr lands.
        </p>
      </header>

      <CampaignFilters category={category} query={query} sort={sort} />

      <div className="mt-6 text-sm text-muted-foreground">
        {campaigns.length} {campaigns.length === 1 ? "campaign" : "campaigns"}
        {category ? ` in ${CATEGORY_LABELS[category]}` : ""}
        {query ? ` matching “${query}”` : ""}
      </div>

      {campaigns.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <SearchX className="h-10 w-10 text-muted-foreground" aria-hidden />
          <p className="mt-4 font-medium">No campaigns match your filters</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try a different category or clear your search.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {campaigns.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  );
}

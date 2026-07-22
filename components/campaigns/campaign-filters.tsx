"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import type { CampaignCategory } from "@prisma/client";
import { useDict } from "@/lib/use-dict";

const CATEGORIES = Object.keys(CATEGORY_LABELS) as CampaignCategory[];

export function CampaignFilters({
  category,
  query,
  sort,
}: {
  category?: string;
  query?: string;
  sort?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const dict = useDict();
  const [text, setText] = React.useState(query ?? "");

  const SORTS = [
    { value: "newest", label: dict.list.sortNewest },
    { value: "most_funded", label: dict.list.sortMostFunded },
    { value: "ending_soon", label: dict.list.sortEndingSoon },
  ];

  React.useEffect(() => {
    setText(query ?? "");
  }, [query]);

  const setParam = React.useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) params.set(key, value);
      else params.delete(key);
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setParam("q", text.trim() || null);
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={dict.list.searchPlaceholder}
            aria-label={dict.list.search}
            className="h-10 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <select
          value={sort ?? "newest"}
          onChange={(e) => setParam("sort", e.target.value === "newest" ? null : e.target.value)}
          aria-label="Sort campaigns"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </form>

      <div className="flex flex-wrap gap-2">
        <Chip active={!category} onClick={() => setParam("category", null)}>
          {dict.list.all}
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            active={category === c}
            onClick={() => setParam("category", category === c ? null : c)}
          >
            {dict.categories[c]}
          </Chip>
        ))}
        {(category || query) && (
          <button
            type="button"
            onClick={() => router.push(pathname, { scroll: false })}
            className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            {dict.list.clear}
          </button>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
        active
          ? "border-transparent bg-primary text-primary-foreground"
          : "border-input bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground"
      )}
    >
      {children}
    </button>
  );
}

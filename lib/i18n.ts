import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import {
  dictionaries,
  LOCALE_COOKIE,
  type Locale,
  type Dict,
} from "@/lib/i18n-data";

// Re-export the client-safe data/types so server components can keep importing
// everything from "@/lib/i18n".
export * from "@/lib/i18n-data";

/** SiteContent key that stores admin translation overrides. */
export const I18N_OVERRIDES_KEY = "i18n_overrides";

/** Overrides shape: per-locale maps of dot-path → replacement string. */
export type I18nOverrides = Partial<Record<Locale, Record<string, string>>>;

/** Current locale from the cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "am" ? "am" : "en";
}

/** Admin overrides from the CMS (per-request cached). */
export const getOverrides = cache(async (): Promise<I18nOverrides> => {
  try {
    const row = await db.siteContent.findUnique({
      where: { key: I18N_OVERRIDES_KEY },
      select: { value: true },
    });
    return (row?.value as I18nOverrides) ?? {};
  } catch {
    return {};
  }
});

/** Deep-clone `base` and apply each dot-path override (e.g. "home.activeTitle"). */
function applyOverrides(base: Dict, patch: Record<string, string>): Dict {
  if (!patch || Object.keys(patch).length === 0) return base;
  const clone = structuredClone(base) as unknown as Record<string, unknown>;
  for (const [path, value] of Object.entries(patch)) {
    if (typeof value !== "string" || !value.trim()) continue;
    const keys = path.split(".");
    let node = clone;
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (typeof node[k] !== "object" || node[k] === null) break;
      node = node[k] as Record<string, unknown>;
    }
    const last = keys[keys.length - 1];
    if (last in node) node[last] = value;
  }
  return clone as unknown as Dict;
}

/** The dictionary for the current locale, with CMS overrides applied. */
export const getDictionary = cache(async (): Promise<Dict> => {
  const locale = await getLocale();
  const overrides = (await getOverrides())[locale];
  return applyOverrides(dictionaries[locale], overrides ?? {});
});

import "server-only";
import { cookies } from "next/headers";
import { dictionaries, LOCALE_COOKIE, type Locale, type Dict } from "@/lib/i18n-data";

// Re-export the client-safe data/types so server components can keep importing
// everything from "@/lib/i18n".
export * from "@/lib/i18n-data";

/** Current locale from the cookie (defaults to English). */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "am" ? "am" : "en";
}

/** The dictionary for the current locale. */
export async function getDictionary(): Promise<Dict> {
  return dictionaries[await getLocale()];
}

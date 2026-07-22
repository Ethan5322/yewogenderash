"use client";

import * as React from "react";
import {
  dictionaries,
  DEFAULT_LOCALE,
  localeFromCookie,
  type Dict,
  type Locale,
} from "@/lib/i18n-data";

/**
 * Client-component localisation. Reads the `locale` cookie after mount and
 * returns the matching dictionary. Renders English on the first paint (to match
 * the server) then swaps to Amharic if selected — a brief, acceptable flash on
 * the client-only auth/wizard forms.
 */
export function useDict(): Dict {
  const [locale, setLocale] = React.useState<Locale>(DEFAULT_LOCALE);
  React.useEffect(() => {
    setLocale(localeFromCookie(document.cookie));
  }, []);
  return dictionaries[locale];
}

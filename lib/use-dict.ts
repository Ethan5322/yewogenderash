"use client";

import * as React from "react";
import {
  dictionaries,
  DEFAULT_LOCALE,
  localeFromCookie,
  type Dict,
} from "@/lib/i18n-data";
import { useDictContext } from "@/lib/dict-context";

/**
 * Client-component localisation. Prefers the DictProvider value (server-resolved
 * locale + CMS overrides, no flash). Where no provider is present, falls back to
 * reading the locale cookie after mount and using the static dictionary.
 */
export function useDict(): Dict {
  const ctx = useDictContext();
  const [cookieDict, setCookieDict] = React.useState<Dict>(dictionaries[DEFAULT_LOCALE]);
  React.useEffect(() => {
    setCookieDict(dictionaries[localeFromCookie(document.cookie)]);
  }, []);
  return ctx ?? cookieDict;
}

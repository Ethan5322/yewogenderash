"use client";

import * as React from "react";
import type { Dict } from "@/lib/i18n-data";

/**
 * Carries the server-resolved dictionary (correct locale + CMS overrides
 * applied) down to client components, so useDict returns the same strings the
 * server rendered — no flash, and admin overrides take effect everywhere.
 */
const DictContext = React.createContext<Dict | null>(null);

export function DictProvider({ dict, children }: { dict: Dict; children: React.ReactNode }) {
  return <DictContext.Provider value={dict}>{children}</DictContext.Provider>;
}

export function useDictContext(): Dict | null {
  return React.useContext(DictContext);
}

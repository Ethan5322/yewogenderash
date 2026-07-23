import { getDictionary } from "@/lib/i18n";
import { DictProvider } from "@/lib/dict-context";

/** Provides the resolved dictionary to owner-dashboard client forms (e.g. the
 * campaign editor) so they render in the chosen language with CMS overrides. */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dict = await getDictionary();
  return <DictProvider dict={dict}>{children}</DictProvider>;
}

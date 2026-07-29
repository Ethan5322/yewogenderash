import { getDictionary } from "@/lib/i18n";
import { DictProvider } from "@/lib/dict-context";

/** Provides the resolved dictionary to owner-dashboard client forms (e.g. the
 * campaign editor) so they render in the chosen language with CMS overrides. */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dict = await getDictionary();
  return (
    <DictProvider dict={dict}>
      {/*
        Room for the phone's fixed bottom nav bar, so it never covers the last
        line of a page. Applied once here rather than as padding on ten
        different <main> elements — a new dashboard screen inherits it instead
        of having to remember it. No effect from md up, where the nav is a tab
        strip at the top and takes its own space in the flow.
      */}
      <div className="pb-16 md:pb-0">{children}</div>
    </DictProvider>
  );
}

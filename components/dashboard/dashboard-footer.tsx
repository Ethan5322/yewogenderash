import { getDictionary } from "@/lib/i18n";
import { SiteFooter } from "@/components/site/site-footer";

/**
 * The site footer for fundraiser screens, with the dictionary resolved here.
 *
 * The public layout passes `dict` to SiteFooter, but every dashboard page
 * rendered a bare `<SiteFooter />`, which falls back to English. A fundraiser
 * reading the site in Amharic therefore got an Amharic public site and an
 * English footer on every screen behind the login.
 *
 * SiteFooter is a server component, so it cannot read the dictionary from React
 * context the way the header now does — this wrapper fetches it instead, so no
 * dashboard page has to.
 */
export async function DashboardFooter() {
  const dict = await getDictionary();
  return <SiteFooter dict={dict} />;
}

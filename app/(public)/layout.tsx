import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { AnnouncementBanner } from "@/components/site/announcement-banner";
import { getDictionary } from "@/lib/i18n";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [session, dict] = await Promise.all([auth(), getDictionary()]);
  return (
    <>
      <AnnouncementBanner />
      <SiteHeader user={session?.user ?? null} dict={dict} />
      <main className="flex-1">{children}</main>
      <SiteFooter dict={dict} />
    </>
  );
}

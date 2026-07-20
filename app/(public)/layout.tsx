import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { AnnouncementBanner } from "@/components/site/announcement-banner";

export default async function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  return (
    <>
      <AnnouncementBanner />
      <SiteHeader user={session?.user ?? null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </>
  );
}

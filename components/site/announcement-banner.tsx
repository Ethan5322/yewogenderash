import Link from "next/link";
import { Megaphone } from "lucide-react";
import { getContent } from "@/lib/content";

/**
 * Site-wide announcement bar, admin-controlled via /admin/content. Renders
 * nothing unless enabled and non-empty, so it costs no layout space by default.
 */
export async function AnnouncementBanner() {
  const banner = await getContent("site.announcement");
  if (!banner.enabled || !banner.message) return null;

  const content = (
    <span className="flex items-center justify-center gap-2 text-center">
      <Megaphone className="h-4 w-4 shrink-0" aria-hidden />
      <span>{banner.message}</span>
    </span>
  );

  return (
    <div className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
      {banner.href ? (
        <Link
          href={banner.href}
          className="block underline-offset-2 hover:underline"
        >
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}

import Link from "next/link";
import { currentAdmin, hasPermission, type AdminPermission } from "@/lib/admin/permissions";

/**
 * A cross-module link that degrades to plain text when the viewing admin lacks
 * the capability to open it.
 *
 * Admin screens legitimately reference each other — a payout row names its
 * campaign, a donation names the fundraiser. But a finance admin without the
 * `campaigns` capability who clicks through to a campaign is only bounced to
 * `/admin?denied=campaigns`. Offering a link that cannot work is worse than
 * showing the name, so this renders the label unlinked instead.
 *
 * Server component: `currentAdmin()` is React-cached, so using this once per
 * table row costs one query for the whole render.
 */
export async function PermLink({
  perm,
  href,
  children,
  className = "font-medium text-primary hover:underline",
  fallbackClassName = "font-medium",
}: {
  perm: AdminPermission;
  href: string;
  children: React.ReactNode;
  className?: string;
  /** Applied to the plain-text form shown when the link isn't permitted. */
  fallbackClassName?: string;
}) {
  const me = await currentAdmin();
  if (!hasPermission(me, perm)) {
    return <span className={fallbackClassName}>{children}</span>;
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

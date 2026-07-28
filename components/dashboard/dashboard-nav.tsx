import { auth } from "@/auth";
import { db } from "@/lib/db";
import { ownerUnreadCount } from "@/lib/messages";
import { getDictionary } from "@/lib/i18n";
import { DashboardNavBar, type DashboardNavItem } from "./dashboard-nav-bar";

/**
 * Server half of the fundraiser navigation: works out which sections this user
 * actually has, and how many messages are waiting for them.
 *
 * The unread count is the point of this being a server component. Admins send
 * fundraisers KYC decisions and payout notes, and until now nothing told the
 * fundraiser a message had arrived — `ownerUnreadCount` existed but was never
 * called anywhere. Now it drives a badge they cannot miss.
 *
 * Sections that only exist once someone has an owner profile are left out until
 * they do, so the bar never offers a link that just bounces them to /start.
 */
export async function DashboardNav() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const t = (await getDictionary()).dashboard.nav;
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { ownerProfile: { select: { id: true } } },
  });
  const ownerId = user?.ownerProfile?.id ?? null;
  const unread = ownerId ? await ownerUnreadCount(ownerId) : 0;

  const items: DashboardNavItem[] = [
    { href: "/dashboard", label: t.overview, key: "overview" },
    { href: "/dashboard/campaigns", label: t.campaigns, key: "campaigns" },
  ];
  if (ownerId) {
    items.push(
      { href: "/dashboard/payouts", label: t.payouts, key: "payouts" },
      { href: "/dashboard/messages", label: t.messages, key: "messages", badge: unread },
      { href: "/dashboard/id", label: t.id, key: "id" }
    );
  }
  items.push({ href: "/dashboard/settings", label: t.settings, key: "settings" });

  return <DashboardNavBar items={items} />;
}

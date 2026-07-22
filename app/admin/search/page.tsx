import Link from "next/link";
import { Search } from "lucide-react";
import { db } from "@/lib/db";
import { currentAdmin, hasPermission } from "@/lib/admin/permissions";
import { formatETB, formatDate } from "@/lib/format";
import { PageHeader, SectionCard, StatusChip, EmptyRow } from "@/components/admin/ui";

export const metadata = { title: "Admin · Search" };

/**
 * Global back-office search. Spans campaigns, owners and donations, but only
 * the datasets this admin is permitted to see (a support agent never searches
 * the money, a finance admin never browses KYC identities).
 */
export default async function AdminSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await currentAdmin();
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q : "").trim().slice(0, 80);

  const canCampaigns = hasPermission(me, "campaigns");
  const canOwners = hasPermission(me, "kyc");
  const canFinance = hasPermission(me, "payouts");

  const contains = { contains: q, mode: "insensitive" as const };

  const [campaigns, owners, donations] = await Promise.all([
    q && canCampaigns
      ? db.campaign.findMany({
          where: { OR: [{ title: contains }, { queryCode: contains }, { slug: contains }] },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, title: true, status: true, queryCode: true, currentAmount: true },
        })
      : Promise.resolve([]),
    q && canOwners
      ? db.user.findMany({
          where: {
            ownerProfile: { isNot: null },
            OR: [{ name: contains }, { email: contains }],
          },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: { id: true, name: true, email: true, verificationStatus: true, ownerProfile: { select: { id: true } } },
        })
      : Promise.resolve([]),
    q && canFinance
      ? db.donation.findMany({
          where: { OR: [{ txRef: contains }, { donorName: contains }, { gatewayTransactionId: contains }] },
          orderBy: { createdAt: "desc" },
          take: 8,
          select: {
            id: true, amount: true, currency: true, status: true, txRef: true,
            donorName: true, createdAt: true, campaign: { select: { id: true, title: true } },
          },
        })
      : Promise.resolve([]),
  ]);

  const total = campaigns.length + owners.length + donations.length;

  return (
    <div>
      <PageHeader
        title="Search"
        description={q ? `Results for “${q}”` : "Search across campaigns, owners and donations."}
      />

      <form action="/admin/search" className="relative mb-6 max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          name="q"
          defaultValue={q}
          autoFocus
          placeholder="Campaign title, querycode, owner name/email, transaction ref…"
          className="h-11 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </form>

      {!q ? (
        <p className="text-sm text-muted-foreground">Type above to search.</p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">No matches found.</p>
      ) : (
        <div className="space-y-5">
          {canCampaigns ? (
            <SectionCard title={`Campaigns (${campaigns.length})`} bodyClassName="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {campaigns.length === 0 ? (
                    <EmptyRow colSpan={3}>No campaigns match.</EmptyRow>
                  ) : (
                    campaigns.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/campaigns/${c.id}`} className="font-medium hover:text-primary hover:underline">
                            {c.title}
                          </Link>
                          <span className="ml-2 font-mono text-xs text-muted-foreground">{c.queryCode}</span>
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={c.status} /></td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatETB(Number(c.currentAmount))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          ) : null}

          {canOwners ? (
            <SectionCard title={`Owners (${owners.length})`} bodyClassName="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {owners.length === 0 ? (
                    <EmptyRow colSpan={2}>No owners match.</EmptyRow>
                  ) : (
                    owners.map((o) => (
                      <tr key={o.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/owners/${o.ownerProfile?.id ?? o.id}`} className="font-medium hover:text-primary hover:underline">
                            {o.name}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{o.email}</span>
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={o.verificationStatus} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          ) : null}

          {canFinance ? (
            <SectionCard title={`Donations (${donations.length})`} bodyClassName="p-0">
              <table className="w-full text-sm">
                <tbody>
                  {donations.length === 0 ? (
                    <EmptyRow colSpan={4}>No donations match.</EmptyRow>
                  ) : (
                    donations.map((d) => (
                      <tr key={d.id} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.txRef}</td>
                        <td className="px-4 py-2.5">
                          <Link href={`/admin/campaigns/${d.campaign.id}`} className="hover:text-primary hover:underline">
                            {d.campaign.title}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{d.donorName ?? "Anonymous"}</span>
                        </td>
                        <td className="px-4 py-2.5"><StatusChip status={d.status} /></td>
                        <td className="px-4 py-2.5 text-right font-medium">{formatETB(Number(d.amount), d.currency)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </SectionCard>
          ) : null}
        </div>
      )}
    </div>
  );
}

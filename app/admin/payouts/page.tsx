import Link from "next/link";
import { Download } from "lucide-react";
import type { PayoutStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { PayoutDecisionPanel } from "@/components/admin/payout-decision-panel";
import { Pager, pageFrom } from "@/components/admin/pager";
import { PageHeader, StatusChip } from "@/components/admin/ui";
import { formatETB, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 50;

export const metadata = { title: "Admin · Payouts" };

const FILTERS: { value: PayoutStatus | "ALL"; label: string }[] = [
  { value: "REQUESTED", label: "Requested" },
  { value: "APPROVED", label: "Approved (to pay)" },
  { value: "PAID", label: "Paid" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "ALL", label: "All" },
];
const VALID = new Set(FILTERS.map((f) => f.value));

export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission("payouts");
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "REQUESTED";
  const status = (VALID.has(raw as PayoutStatus | "ALL") ? raw : "REQUESTED") as
    | PayoutStatus
    | "ALL";
  const page = pageFrom(sp.page);
  const where = status === "ALL" ? {} : { status };

  const [payouts, matchCount] = await Promise.all([
    db.payout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      amount: true,
      currency: true,
      status: true,
      payoutReference: true,
      note: true,
      createdAt: true,
      approvedAt: true,
      paidAt: true,
      campaign: { select: { id: true, title: true } },
      owner: {
        select: {
          id: true,
          mulesooVerified: true,
          payoutAccounts: {
            where: { isDefault: true, isVerified: true },
            select: { bankName: true, accountNumber: true, accountName: true },
            take: 1,
          },
          user: { select: { name: true, email: true, verificationStatus: true } },
        },
      },
    },
    }),
    db.payout.count({ where }),
  ]);

  return (
    <div>
      <PageHeader
        title="Payouts"
        description="Every release requires approval here, then a recorded transfer reference. Owners can never self-release funds."
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/payouts?status=${f.value}`}
              className={cn(
                "rounded-full border px-3 py-1 text-sm font-medium transition-colors",
                status === f.value
                  ? "border-transparent bg-primary text-primary-foreground"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {f.label}
            </Link>
          ))}
        </div>
        <a
          href={`/admin/payouts/export?status=${status}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <Download className="h-4 w-4" aria-hidden /> Export CSV
        </a>
      </div>

      <div className="mt-6 overflow-x-auto rounded-xl border bg-card shadow-sm">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-4 py-3 font-medium">Requested</th>
              <th className="px-4 py-3 font-medium">Campaign</th>
              <th className="px-4 py-3 font-medium">Owner / account</th>
              <th className="px-4 py-3 font-medium">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {payouts.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No payouts match this filter.
                </td>
              </tr>
            ) : (
              payouts.map((p) => {
                const account = p.owner.payoutAccounts[0] ?? null;
                return (
                  <tr key={p.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {formatDate(p.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/campaigns/${p.campaign.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {p.campaign.title}
                      </Link>
                      {p.note ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{p.note}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/owners/${p.owner.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {p.owner.user.name}
                      </Link>
                      {/* KYC at a glance — never release money to an unverified owner */}
                      <span className="mt-0.5 block">
                        <StatusChip status={p.owner.user.verificationStatus} />
                      </span>
                      <p className={cn(
                        "mt-0.5 text-xs",
                        account ? "text-muted-foreground" : "font-medium text-destructive"
                      )}>
                        {account
                          ? `${account.bankName} · ${account.accountNumber}`
                          : "no verified payout account"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">
                      {formatETB(Number(p.amount), p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusChip status={p.status} />
                      {p.payoutReference ? (
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {p.payoutReference}
                        </p>
                      ) : null}
                      {p.paidAt ? (
                        <p className="text-xs text-muted-foreground">
                          paid {formatDate(p.paidAt)}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3">
                      <PayoutDecisionPanel payoutId={p.id} status={p.status} />
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pager
        basePath="/admin/payouts"
        baseParams={{ status }}
        page={page}
        pageSize={PAGE_SIZE}
        total={matchCount}
      />
    </div>
  );
}

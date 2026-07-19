import Link from "next/link";
import type { PayoutStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { PayoutDecisionPanel } from "@/components/admin/payout-decision-panel";
import { formatETB, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

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
  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status : "REQUESTED";
  const status = (VALID.has(raw as PayoutStatus | "ALL") ? raw : "REQUESTED") as
    | PayoutStatus
    | "ALL";

  const payouts = await db.payout.findMany({
    where: status === "ALL" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
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
          payoutAccount: true,
          user: { select: { name: true, email: true } },
        },
      },
    },
  });

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight">Payouts</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Every release requires approval here, then a recorded transfer
        reference. Owners can never self-release funds.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
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
                const account = p.owner.payoutAccount as {
                  accountType?: string;
                  accountName?: string;
                  accountNumber?: string;
                  bankName?: string | null;
                } | null;
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
                        className="hover:text-primary hover:underline"
                      >
                        {p.owner.user.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {account
                          ? `${account.accountType === "TELEBIRR" ? "Telebirr" : account.bankName || "Bank"} · ${account.accountNumber}`
                          : "no payout account"}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap font-semibold">
                      {formatETB(Number(p.amount), p.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold">{p.status}</span>
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
    </div>
  );
}

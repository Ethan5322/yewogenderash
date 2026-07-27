import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { campaignAvailableBalance, campaignWithholdingDue } from "@/lib/payouts";
import { WITHHOLDING_FEE_RATE, PLATFORM_FEE_RATE } from "@/lib/fees";
import { listChapaBanks } from "@/lib/chapa";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  PayoutRequestForm,
  CancelPayoutButton,
} from "@/components/dashboard/payout-controls";
import { PayoutAccountForm } from "@/components/dashboard/payout-account-form";
import { formatETB, formatDate } from "@/lib/format";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";

export const metadata: Metadata = { title: "Payouts" };

const PAYOUT_STATUS_STYLE: Record<string, string> = {
  REQUESTED: "text-warning",
  APPROVED: "text-primary",
  PAID: "text-success",
  REJECTED: "text-destructive",
  CANCELLED: "text-muted-foreground",
};

export default async function OwnerPayoutsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/payouts");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      payoutAccounts: {
        where: { isDefault: true },
        take: 1,
        select: {
          accountName: true,
          bankName: true,
          accountNumber: true,
          isVerified: true,
        },
      },
      campaigns: {
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { id: true, title: true, currency: true },
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 30,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          payoutReference: true,
          note: true,
          createdAt: true,
          paidAt: true,
          campaign: { select: { title: true } },
        },
      },
    },
  });
  if (!owner) redirect("/start");

  const withholdingRatePct = Math.round(WITHHOLDING_FEE_RATE * 100);
  const campaignsWithBalance = await Promise.all(
    owner.campaigns.map(async (c) => {
      const [available, withholding] = await Promise.all([
        campaignAvailableBalance(c.id),
        campaignWithholdingDue(c.id),
      ]);
      return {
        ...c,
        available,
        withholdingDue: withholding.due,
        withholdingRatePct,
      };
    })
  );
  const requestable = campaignsWithBalance.filter((c) => c.available >= 100);

  const account = owner.payoutAccounts[0] ?? null;
  // Chapa's supported-bank list drives the account form's dropdown.
  const banksRes = await listChapaBanks().catch(() => ({ ok: false as const, error: "" }));
  const banks = banksRes.ok
    ? banksRes.banks.map((b) => ({ code: String(b.id), name: b.name }))
    : [];

  return (
    <>
      <SiteHeader user={session.user} />
      <DashboardNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Payouts
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Each campaign's funds stay in their own ledger. Payouts are released
          only after admin approval, and every release is recorded.
        </p>

        <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Payout bank account</h2>
          {account ? (
            <div className="mt-3 rounded-lg border bg-muted/30 p-4 text-sm">
              <p className="font-medium">
                {account.accountName} · {account.bankName}
              </p>
              <p className="mt-0.5 text-muted-foreground">
                Account ending {account.accountNumber.slice(-4)}
                {account.isVerified ? (
                  <span className="ml-2 text-success">✓ verified</span>
                ) : (
                  <span className="ml-2 text-warning">pending verification</span>
                )}
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Donations to your campaigns settle here automatically, after the
                3% platform fee. Add a new account below to replace it.
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Add a verified bank account so donations can settle to you. The
              platform fee (3%) is taken automatically at payment time.
            </p>
          )}
          <div className="mt-4">
            <PayoutAccountForm banks={banks} />
          </div>
        </section>

        {/* Balances — each one clicks through to its full transaction statement,
            so a fundraiser can always see exactly what the figure is made of. */}
        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Your balances</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each figure is what remains after the {Math.round(PLATFORM_FEE_RATE * 100)}%
            transaction fee has been deducted from every donation — that is{" "}
            {Math.round((1 - PLATFORM_FEE_RATE) * 100)}% of what your donors gave.
            Tap a campaign to see every transaction.
          </p>
          {campaignsWithBalance.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">
              You don&apos;t have any campaigns yet.
            </p>
          ) : (
            <ul className="mt-4 divide-y rounded-lg border">
              {campaignsWithBalance.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/campaigns/${c.id}/transactions`}
                    className="group flex items-center justify-between gap-4 p-4 transition-colors hover:bg-muted/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{c.title}</span>
                      <span className="text-xs text-muted-foreground">
                        View transaction statement
                        {c.withholdingDue > 0
                          ? ` · ${formatETB(c.withholdingDue, c.currency)} safety withholding still due`
                          : ""}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="font-display text-lg font-bold tabular-nums text-primary">
                        {formatETB(c.available, c.currency)}
                      </span>
                      <ChevronRight
                        className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Withdraw funds</h2>
          {!account?.isVerified ? (
            <p className="mt-2 text-sm text-warning">
              Add a verified payout account above before requesting a payout.
            </p>
          ) : null}
          <div className="mt-4">
            <PayoutRequestForm campaigns={requestable} />
          </div>
        </section>

        <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <h2 className="font-display text-base font-semibold">Payout history</h2>
          {owner.payouts.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No payouts yet.</p>
          ) : (
            <ul className="mt-3 divide-y">
              {owner.payouts.map((p) => (
                <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {formatETB(Number(p.amount), p.currency)} · {p.campaign.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Requested {formatDate(p.createdAt)}
                      {p.paidAt ? ` · paid ${formatDate(p.paidAt)}` : ""}
                      {p.payoutReference ? ` · ref ${p.payoutReference}` : ""}
                      {p.note ? ` · ${p.note}` : ""}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span
                      className={`text-xs font-semibold ${PAYOUT_STATUS_STYLE[p.status] ?? ""}`}
                    >
                      {p.status}
                    </span>
                    {p.status === "REQUESTED" ? (
                      <CancelPayoutButton payoutId={p.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </>
  );
}

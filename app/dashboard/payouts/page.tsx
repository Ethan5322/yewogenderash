import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { campaignAvailableBalance } from "@/lib/payouts";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  PayoutRequestForm,
  CancelPayoutButton,
} from "@/components/dashboard/payout-controls";
import { formatETB, formatDate } from "@/lib/format";

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

  const campaignsWithBalance = await Promise.all(
    owner.campaigns.map(async (c) => ({
      ...c,
      available: await campaignAvailableBalance(c.id),
    }))
  );
  const requestable = campaignsWithBalance.filter((c) => c.available >= 100);

  return (
    <>
      <SiteHeader />
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
          <h2 className="font-display text-base font-semibold">Request a payout</h2>
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

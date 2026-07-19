import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { settleDonation } from "@/lib/donations";
import { deliverQueuedNotifications } from "@/lib/notifications";
import { Button } from "@/components/ui/button";
import { formatETB, formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Thank you",
  robots: { index: false, follow: false },
};

export default async function DonationThanksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const txRef = typeof sp.tx_ref === "string" ? sp.tx_ref : null;
  if (!txRef) notFound();

  // Fallback settlement for missed webhooks (e.g. localhost). Idempotent —
  // if the webhook already settled it, this is a no-op read.
  let donation = await db.donation.findUnique({
    where: { txRef },
    include: { campaign: { select: { title: true, slug: true } } },
  });
  if (!donation) notFound();

  if (donation.status === "PENDING") {
    const settled = await settleDonation(txRef).catch(() => null);
    if (settled?.outcome === "success") {
      await deliverQueuedNotifications().catch(() => {});
    }
    donation = await db.donation.findUnique({
      where: { txRef },
      include: { campaign: { select: { title: true, slug: true } } },
    });
    if (!donation) notFound();
  }

  const success = donation.status === "SUCCESS";
  const pending = donation.status === "PENDING";

  return (
    <div className="mx-auto max-w-lg px-4 py-16 sm:px-6">
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        {success ? (
          <CheckCircle2 className="mx-auto h-14 w-14 text-success" aria-hidden />
        ) : pending ? (
          <Clock className="mx-auto h-14 w-14 text-warning" aria-hidden />
        ) : (
          <XCircle className="mx-auto h-14 w-14 text-destructive" aria-hidden />
        )}

        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight">
          {success
            ? "Thank you for your donation!"
            : pending
              ? "Payment being confirmed…"
              : "Payment not completed"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {success
            ? "Your gift has been confirmed and credited to the campaign's ledger."
            : pending
              ? "The gateway hasn't confirmed this payment yet. This page will show the receipt once confirmation arrives — check back shortly."
              : "This payment was not completed. No money has been credited. You can try again any time."}
        </p>

        {/* Receipt (§10.3) */}
        <dl className="mt-6 space-y-2 rounded-lg border bg-background p-4 text-left text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Campaign</dt>
            <dd className="font-medium">{donation.campaign.title}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Amount</dt>
            <dd className="font-semibold">
              {formatETB(Number(donation.amount), donation.currency)}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Status</dt>
            <dd className="font-medium">{donation.status}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Date</dt>
            <dd>{formatDate(donation.paidAt ?? donation.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Donation ID</dt>
            <dd className="font-mono text-xs">{donation.id}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Reference</dt>
            <dd className="font-mono text-xs">{donation.txRef}</dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild>
            <Link href={`/campaigns/${donation.campaign.slug}`}>
              Back to campaign <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/campaigns">Browse more campaigns</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

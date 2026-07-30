"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Landmark, XCircle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  requestPayoutAction,
  cancelPayoutAction,
  type ActionResult,
} from "@/app/dashboard/payouts/actions";
import { formatETB } from "@/lib/format";

export type WithdrawableCampaign = {
  id: string;
  title: string;
  currency: string;
  available: number;
  /** Outstanding safety & guarantee withholding on this campaign (7% of gross,
   *  charged once). Deducted from this withdrawal. */
  withholdingDue: number;
  withholdingRatePct: number;
  /** The full balance this campaign pays out — computed server-side. The
   *  fundraiser does not choose an amount, so this is the whole figure. */
  maxWithdrawable: number;
};

/** Round to birr cents the same way the server does, for the live preview. */
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function PayoutRequestForm({
  campaigns,
}: {
  campaigns: WithdrawableCampaign[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    requestPayoutAction,
    null
  );
  const [campaignId, setCampaignId] = React.useState(campaigns[0]?.id ?? "");
  const [confirmed, setConfirmed] = React.useState(false);
  const selected = campaigns.find((c) => c.id === campaignId);

  // A campaign is withdrawn ONCE, in full, so there is no amount to type and
  // nothing to validate — the figure comes from the server and is posted back
  // unchanged. The breakdown below is disclosure, not a calculator.
  const wanted = selected?.maxWithdrawable ?? 0;
  const withholding = selected ? round2(Math.max(0, selected.withholdingDue)) : 0;
  const chargedToBalance = round2(wanted + withholding);

  // Choosing a different campaign must clear the tick: it is a confirmation of
  // one specific irreversible payout, not a general agreement.
  React.useEffect(() => {
    setConfirmed(false);
  }, [campaignId]);

  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  if (campaigns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Payouts become available once one of your campaigns has confirmed
        donations.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="payout-campaign" className="text-sm font-medium">
            Campaign
          </label>
          <select
            id="payout-campaign"
            name="campaignId"
            value={campaignId}
            onChange={(e) => setCampaignId(e.target.value)}
            className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} — {formatETB(c.available, c.currency)} available
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="text-sm font-medium">You will receive</span>
          {/* Fixed, not editable. Posted as a hidden field and re-derived on the
              server, which rejects anything that is not the full balance. */}
          <p className="mt-1.5 flex h-10 items-center font-display text-lg font-bold tabular-nums text-primary">
            {selected ? formatETB(wanted, selected.currency) : "—"}
          </p>
          <input type="hidden" name="amount" value={wanted} />
          <p className="text-xs text-muted-foreground">
            Your whole balance, paid in one transfer.
          </p>
        </div>
      </div>

      {/* What this withdrawal actually pays out — shown before they commit. */}
      {selected && wanted > 0 ? (
        <dl className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
          {/* Reads top-down as: this is yours, this is the fee, this is what
              leaves the balance. The old version led with the charge and made
              the received figure the surprise at the bottom. */}
          <div className="flex items-center justify-between gap-4">
            <dt className="font-semibold">You will receive</dt>
            <dd className="font-display text-base font-bold tabular-nums text-primary">
              {formatETB(wanted, selected.currency)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">
              Safety &amp; guarantee withholding
              <span className="block text-xs">
                {selected.withholdingRatePct}% of total donated, charged once per campaign
                {withholding === 0 ? " — already collected" : ""}
              </span>
            </dt>
            <dd className="tabular-nums text-destructive">
              + {formatETB(withholding, selected.currency)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-2">
            <dt className="text-muted-foreground">Taken from your balance</dt>
            <dd className="font-medium tabular-nums">
              {formatETB(chargedToBalance, selected.currency)}
            </dd>
          </div>
        </dl>
      ) : null}

      <p className="flex items-start gap-2 text-xs text-muted-foreground">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        Submitting sends a transfer report to the administrators automatically.
        They verify the request and transfer the funds to your registered bank
        account — funds are never released without that check.
      </p>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">
          Withdrawal requested. The report has been sent to the administrators —
          you&apos;ll be notified when the transfer is made.
        </p>
      ) : null}

      {/* This is the campaign's ONLY withdrawal and it cannot be repeated, so it
          asks for a deliberate tick rather than accepting one stray click. */}
      {selected && wanted > 0 ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
          />
          <span>
            I understand this is the{" "}
            <strong>only withdrawal for this campaign</strong> and pays out the
            full balance of {formatETB(wanted, selected.currency)}. It cannot be
            repeated or split.
          </span>
        </label>
      ) : null}

      <Button
        type="submit"
        disabled={pending || !selected || wanted < 100 || !confirmed}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" aria-hidden />
        )}
        Withdraw
        {selected && wanted > 0 ? ` ${formatETB(wanted, selected.currency)}` : ""}
        <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </form>
  );
}

export function CancelPayoutButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="text-right">
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await cancelPayoutAction(payoutId);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <XCircle className="h-4 w-4" aria-hidden />
        )}
        Cancel
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

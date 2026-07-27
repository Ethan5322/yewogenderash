"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Landmark, XCircle, Info, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  const [amount, setAmount] = React.useState("");
  const selected = campaigns.find((c) => c.id === campaignId);

  // Live preview of the deduction. The server re-computes this authoritatively
  // when the request is recorded; this only shows the fundraiser what to expect
  // BEFORE they commit, so the 7% is never a surprise after the fact.
  const requested = Number(amount) || 0;
  const withholding = selected
    ? round2(Math.min(Math.max(0, selected.withholdingDue), Math.max(0, requested)))
    : 0;
  const willReceive = round2(Math.max(0, requested - withholding));

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
          <label htmlFor="payout-amount" className="text-sm font-medium">
            Amount (ETB)
          </label>
          <Input
            id="payout-amount"
            name="amount"
            type="number"
            min={100}
            max={selected?.available ?? undefined}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1.5"
          />
          {selected ? (
            <button
              type="button"
              onClick={() => setAmount(String(Math.floor(selected.available)))}
              className="mt-1 text-xs font-medium text-primary hover:underline"
            >
              Withdraw all {formatETB(selected.available, selected.currency)}
            </button>
          ) : null}
        </div>
      </div>

      {/* What this withdrawal actually pays out — shown before they commit. */}
      {selected && requested > 0 ? (
        <dl className="space-y-1.5 rounded-lg border bg-muted/30 p-4 text-sm">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-muted-foreground">You are withdrawing</dt>
            <dd className="font-medium tabular-nums">
              {formatETB(requested, selected.currency)}
            </dd>
          </div>
          <div className="flex items-start justify-between gap-4">
            <dt className="text-muted-foreground">
              Safety &amp; guarantee withholding
              <span className="block text-xs">
                {selected.withholdingRatePct}% of total donated, charged once per campaign
                {withholding === 0 && selected.withholdingDue === 0
                  ? " — already collected"
                  : ""}
              </span>
            </dt>
            <dd className="tabular-nums text-destructive">− {formatETB(withholding, selected.currency)}</dd>
          </div>
          <div className="flex items-center justify-between gap-4 border-t pt-2">
            <dt className="font-semibold">You will receive</dt>
            <dd className="font-display text-base font-bold tabular-nums text-primary">
              {formatETB(willReceive, selected.currency)}
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

      <Button type="submit" disabled={pending || !selected || selected.available < 100}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" aria-hidden />
        )}
        Withdraw
        {selected && requested > 0 ? ` ${formatETB(willReceive, selected.currency)}` : ""}
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

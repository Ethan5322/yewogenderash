"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Landmark, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  requestPayoutAction,
  cancelPayoutAction,
  type ActionResult,
} from "@/app/dashboard/payouts/actions";
import { formatETB } from "@/lib/format";

export function PayoutRequestForm({
  campaigns,
}: {
  campaigns: { id: string; title: string; currency: string; available: number }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    requestPayoutAction,
    null
  );
  const [campaignId, setCampaignId] = React.useState(campaigns[0]?.id ?? "");
  const selected = campaigns.find((c) => c.id === campaignId);

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
            className="mt-1.5"
          />
        </div>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">
          Request submitted — an administrator will review it.
        </p>
      ) : null}

      <Button type="submit" disabled={pending || !selected || selected.available < 100}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" aria-hidden />
        )}
        Request payout
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

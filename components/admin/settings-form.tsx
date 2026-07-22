"use client";

import { useActionState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { updatePlatformSettingsAction } from "@/app/admin/settings/actions";

export function SettingsForm({
  feePercent,
  autoApproveMaxEtb,
  minPayoutEtb,
}: {
  feePercent: number;
  autoApproveMaxEtb: number;
  minPayoutEtb: number;
}) {
  const [state, action, pending] = useActionState(updatePlatformSettingsAction, null);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="feePercent" className="block text-sm font-medium">
          Platform fee
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="feePercent"
            name="feePercent"
            type="number"
            step="0.1"
            min="0"
            max="30"
            defaultValue={feePercent}
            required
            className="h-10 w-32 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <span className="text-sm text-muted-foreground">% of each donation</span>
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Applies to <strong>new</strong> payout accounts and future donations.
          Existing fundraisers keep the rate baked into their Chapa subaccount
          until they re-add their bank, so recorded ledgers always reconcile.
        </p>
      </div>

      <div>
        <label htmlFor="autoApproveMaxEtb" className="block text-sm font-medium">
          Auto-approval ceiling
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ETB</span>
          <input
            id="autoApproveMaxEtb"
            name="autoApproveMaxEtb"
            type="number"
            step="1"
            min="0"
            defaultValue={autoApproveMaxEtb}
            required
            className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Withdrawals at or below this amount can auto-approve for established,
          fully-verified owners. Anything larger always routes to manual review.
        </p>
      </div>

      <div>
        <label htmlFor="minPayoutEtb" className="block text-sm font-medium">
          Minimum payout threshold
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">ETB</span>
          <input
            id="minPayoutEtb"
            name="minPayoutEtb"
            type="number"
            step="1"
            min="1"
            defaultValue={minPayoutEtb}
            required
            className="h-10 w-40 rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">
          The smallest amount a fundraiser can withdraw in a single request.
        </p>
      </div>

      {state && !state.ok ? (
        <p className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" aria-hidden /> {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Settings saved.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
    </form>
  );
}

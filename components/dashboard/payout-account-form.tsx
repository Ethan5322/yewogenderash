"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  savePayoutAccountAction,
  type ActionResult,
} from "@/app/dashboard/payouts/account-actions";

export type BankOption = { code: string; name: string };

export function PayoutAccountForm({ banks }: { banks: BankOption[] }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    savePayoutAccountAction,
    null
  );
  const [bankCode, setBankCode] = React.useState(banks[0]?.code ?? "");
  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";

  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-4">
      {/* Bank name travels alongside the code so we store a human label. */}
      <input type="hidden" name="bankName" value={bankName} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="pa-name" className="text-sm font-medium">
            Account holder name
          </label>
          <Input id="pa-name" name="accountName" required maxLength={120} className="mt-1.5" />
        </div>
        <div>
          <label htmlFor="pa-bank" className="text-sm font-medium">
            Bank
          </label>
          {banks.length > 0 ? (
            <select
              id="pa-bank"
              name="bankCode"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              className="mt-1.5 h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          ) : (
            // Fallback if the bank list couldn't be fetched — enter the code.
            <Input id="pa-bank" name="bankCode" required className="mt-1.5" placeholder="Bank code" />
          )}
        </div>
      </div>
      <div>
        <label htmlFor="pa-number" className="text-sm font-medium">
          Account number
        </label>
        <Input
          id="pa-number"
          name="accountNumber"
          inputMode="numeric"
          pattern="[0-9]{6,20}"
          required
          className="mt-1.5"
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">
          Payout account verified and saved. Donations now settle to this bank.
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Landmark className="h-4 w-4" aria-hidden />
        )}
        Verify &amp; save account
      </Button>
    </form>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveConsentAction, type ActionResult } from "@/app/(public)/start/(wizard)/actions";

const CONSENTS = [
  {
    name: "acceptTerms",
    label: "I accept the Terms & Conditions",
    detail: (
      <>
        including the campaign conduct rules. Read the{" "}
        <Link href="/support/terms" target="_blank" className="text-primary underline">
          terms
        </Link>
        .
      </>
    ),
  },
  {
    name: "acceptFees",
    label: "I accept the fee and payout policy",
    detail: (
      <>
        platform fees apply and payouts are admin-approved. Read the{" "}
        <Link href="/support/fees" target="_blank" className="text-primary underline">
          fee policy
        </Link>
        .
      </>
    ),
  },
  {
    name: "biometricConsent",
    label: "I consent to identity & face verification",
    detail: <>my ID and a live face capture will be used to verify my identity.</>,
  },
] as const;

export function ConsentForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveConsentAction,
    null
  );
  const [checked, setChecked] = React.useState<Record<string, boolean>>({});
  const allChecked = CONSENTS.every((c) => checked[c.name]);

  return (
    <form action={action} className="space-y-4">
      {CONSENTS.map((c) => (
        <label
          key={c.name}
          className="flex cursor-pointer items-start gap-3 rounded-lg border p-4 hover:bg-accent/40"
        >
          <input
            type="checkbox"
            name={c.name}
            checked={!!checked[c.name]}
            onChange={(e) => setChecked((s) => ({ ...s, [c.name]: e.target.checked }))}
            className="mt-0.5 h-4 w-4 rounded border-input accent-primary"
          />
          <span className="text-sm">
            <span className="font-medium">{c.label}</span>
            <span className="text-muted-foreground"> — {c.detail}</span>
          </span>
        </label>
      ))}

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={!allChecked || pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Accept &amp; continue <ArrowRight className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </form>
  );
}

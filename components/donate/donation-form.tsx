"use client";

import * as React from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/format";

const PRESETS = [100, 250, 500, 1000, 2500] as const;

/**
 * Donation amount + donor details capture. Payment gateway wiring (Chapa,
 * phase 10) is not connected yet, so submit surfaces a clear pending state
 * rather than pretending a charge succeeded.
 */
export function DonationForm({
  campaignTitle,
  currency,
  compact = false,
}: {
  campaignTitle: string;
  currency: string;
  compact?: boolean;
}) {
  const [amount, setAmount] = React.useState<number | "">(compact ? 250 : "");
  const [custom, setCustom] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [name, setName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  const effectiveAmount =
    custom.trim() !== "" ? Number(custom) : amount === "" ? 0 : amount;
  const valid = effectiveAmount >= 10;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (valid) setSubmitted(true);
      }}
      className="space-y-5"
    >
      <div>
        <label className="text-sm font-medium">Choose an amount</label>
        <div
          className={cn(
            "mt-2 grid gap-2",
            compact ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-5"
          )}
        >
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setAmount(p);
                setCustom("");
              }}
              className={cn(
                "rounded-md border px-2 py-2.5 text-sm font-medium transition-colors",
                amount === p && custom === ""
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-background hover:bg-accent hover:text-accent-foreground"
              )}
            >
              {formatETB(p, currency)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="custom-amount" className="text-sm font-medium">
          Or enter a custom amount
        </label>
        <div className="relative mt-2">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {currency}
          </span>
          <input
            id="custom-amount"
            inputMode="numeric"
            value={custom}
            onChange={(e) => {
              setCustom(e.target.value.replace(/[^0-9.]/g, ""));
              setAmount("");
            }}
            placeholder="0"
            className="h-11 w-full rounded-md border border-input bg-background pl-12 pr-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
      </div>

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymous}
            onChange={(e) => setAnonymous(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-primary"
          />
          Donate anonymously
        </label>
        {!anonymous ? (
          <div>
            <label htmlFor="donor-name" className="text-sm font-medium">
              Your name{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              id="donor-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Shown on the campaign as a supporter"
              className="mt-2 h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        ) : null}
      </div>

      <Button type="submit" size="lg" className="w-full" disabled={!valid}>
        {valid
          ? `Donate ${formatETB(effectiveAmount, currency)}`
          : "Enter an amount to continue"}
      </Button>

      {submitted ? (
        <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
          <p>
            You&apos;re set to give{" "}
            <strong>{formatETB(effectiveAmount, currency)}</strong> to{" "}
            <strong>{campaignTitle}</strong>. Secure checkout via Chapa is being
            connected — no payment has been taken. You&apos;ll be able to complete
            this donation shortly.
          </p>
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely. Funds go only to this campaign&apos;s
          separated ledger.
        </p>
      )}
    </form>
  );
}

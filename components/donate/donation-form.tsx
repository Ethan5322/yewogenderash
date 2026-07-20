"use client";

import * as React from "react";
import { Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatETB } from "@/lib/format";

const PRESETS = [100, 250, 500, 1000, 2500] as const;
const MIN_AMOUNT = 10;

const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Donation form. Creates a PENDING donation via /api/donate, then hands the
 * donor to Chapa's hosted checkout. Confirmation happens only through the
 * webhook/verify path — never in this component.
 */
export function DonationForm({
  queryCode,
  campaignTitle,
  currency,
  compact = false,
}: {
  queryCode: string;
  campaignTitle: string;
  currency: string;
  compact?: boolean;
}) {
  const [amount, setAmount] = React.useState<number | "">(compact ? 250 : "");
  const [custom, setCustom] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [anonymous, setAnonymous] = React.useState(false);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const effectiveAmount =
    custom.trim() !== "" ? Number(custom) : amount === "" ? 0 : amount;
  const valid =
    Number.isInteger(effectiveAmount) &&
    effectiveAmount >= MIN_AMOUNT &&
    /\S+@\S+\.\S+/.test(email);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/donate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          queryCode,
          amount: effectiveAmount,
          email: email.trim(),
          donorName: anonymous ? "" : name,
          anonymous,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.checkoutUrl) {
        // Hand off to the gateway's hosted checkout.
        window.location.href = data.checkoutUrl;
        return;
      }
      setError(data.error ?? "Could not start the payment. Please try again.");
      setBusy(false);
    } catch {
      setError("Network problem — please try again.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
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
              setCustom(e.target.value.replace(/[^0-9]/g, ""));
              setAmount("");
            }}
            placeholder="0"
            className={cn(inputClass, "pl-12")}
          />
        </div>
      </div>

      <div>
        <label htmlFor="donor-email" className="text-sm font-medium">
          Email <span className="font-normal text-muted-foreground">(for your receipt)</span>
        </label>
        <input
          id="donor-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@gmail.com"
          className={cn(inputClass, "mt-2")}
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Use a real email (Gmail, Yahoo, Outlook…) — the payment provider
          verifies it.
        </p>
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
              className={cn(inputClass, "mt-2")}
            />
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button type="submit" size="lg" className="w-full" disabled={!valid || busy}>
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Opening secure checkout…
          </>
        ) : valid ? (
          `Donate ${formatETB(effectiveAmount, currency)}`
        ) : (
          "Enter amount and email to continue"
        )}
      </Button>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
        <Lock className="h-3.5 w-3.5" aria-hidden />
        Secure payment via Chapa — funds go only to “{campaignTitle}”.
      </p>
    </form>
  );
}

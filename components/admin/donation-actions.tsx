"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Undo2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { refundDonationAction, disputeDonationAction } from "@/app/admin/donations/actions";

export function DonationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (status !== "SUCCESS" && status !== "REFUNDED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Failed");
    });

  return (
    <div className="flex flex-col items-start gap-1">
      <div className="flex gap-1">
        {status === "SUCCESS" ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const reason = window.prompt("Reason for refund (optional):") ?? undefined;
              if (window.confirm("Refund this donation? This reverses the campaign's raised amount.")) {
                run(() => refundDonationAction(id, reason));
              }
            }}
          >
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5" aria-hidden />}
            Refund
          </Button>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          disabled={pending}
          onClick={() => {
            const reason = window.prompt("Dispute / chargeback note (optional):") ?? undefined;
            run(() => disputeDonationAction(id, reason));
          }}
        >
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Dispute
        </Button>
      </div>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PayoutStatus } from "@prisma/client";
import { Loader2, Check, X, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { decidePayoutAction } from "@/app/admin/actions";

export function PayoutDecisionPanel({
  payoutId,
  status,
}: {
  payoutId: string;
  status: PayoutStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busyOn, setBusyOn] = React.useState<string | null>(null);

  function run(decision: "approve" | "reject" | "paid") {
    setBusyOn(decision);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("payoutId", payoutId);
      fd.append("note", note);
      fd.append("payoutReference", reference);
      const res = await decidePayoutAction(decision, null, fd);
      setBusyOn(null);
      if (res.ok) {
        setNote("");
        setReference("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  if (status !== "REQUESTED" && status !== "APPROVED") {
    return <span className="text-xs text-muted-foreground">—</span>;
  }

  return (
    <div className="space-y-2">
      {status === "REQUESTED" ? (
        <>
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (required to reject)"
            className="h-8 text-xs"
          />
          <div className="flex gap-1.5">
            <Button size="sm" disabled={pending} onClick={() => run("approve")}>
              {busyOn === "approve" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" aria-hidden />
              )}
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={pending}
              onClick={() => run("reject")}
            >
              {busyOn === "reject" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" aria-hidden />
              )}
              Reject
            </Button>
          </div>
        </>
      ) : (
        <>
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transfer reference (required)"
            className="h-8 text-xs"
          />
          <Button size="sm" disabled={pending || !reference} onClick={() => run("paid")}>
            {busyOn === "paid" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Banknote className="h-3.5 w-3.5" aria-hidden />
            )}
            Mark paid
          </Button>
        </>
      )}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

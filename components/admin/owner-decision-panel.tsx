"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideOwnerAction } from "@/app/admin/actions";

type Decision = "approve" | "reject" | "resubmit";

export function OwnerDecisionPanel({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busyOn, setBusyOn] = React.useState<Decision | null>(null);

  function run(decision: Decision) {
    setBusyOn(decision);
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("ownerId", ownerId);
      fd.append("note", note);
      const res = await decideOwnerAction(decision, null, fd);
      setBusyOn(null);
      if (res.ok) {
        setNote("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="kyc-note" className="text-sm font-medium">
          Note{" "}
          <span className="font-normal text-muted-foreground">
            (required for reject/resubmit — shown to the owner)
          </span>
        </label>
        <textarea
          id="kyc-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => run("approve")}>
          {busyOn === "approve" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" aria-hidden />
          )}
          Approve — grant Mulesoo seal
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending}
          onClick={() => run("resubmit")}
        >
          {busyOn === "resubmit" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden />
          )}
          Request resubmission
        </Button>
        <Button
          size="sm"
          variant="destructive"
          disabled={pending}
          onClick={() => run("reject")}
        >
          {busyOn === "reject" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <X className="h-4 w-4" aria-hidden />
          )}
          Reject
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { VerificationStatus } from "@prisma/client";
import { Loader2, Check, X, RotateCcw, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { decideOwnerAction } from "@/app/admin/actions";

type Decision = "approve" | "reject" | "resubmit" | "revoke";

const META: Record<
  Decision,
  { label: string; icon: React.ElementType; variant: "default" | "destructive" | "outline" | "secondary" }
> = {
  approve: { label: "Allow — grant Mulesoo seal", icon: Check, variant: "default" },
  resubmit: { label: "Request resubmission", icon: RotateCcw, variant: "outline" },
  reject: { label: "Reject", icon: X, variant: "destructive" },
  revoke: { label: "Revoke verification", icon: ShieldOff, variant: "destructive" },
};

/** Which actions make sense from each status (mirrors the server matrix). */
const AVAILABLE: Record<VerificationStatus, Decision[]> = {
  PENDING: ["approve", "resubmit", "reject"],
  UNVERIFIED: ["approve", "resubmit", "reject"],
  RESUBMIT: ["approve", "reject"],
  REJECTED: ["approve", "resubmit"],
  VERIFIED: ["revoke"],
};

export function OwnerDecisionPanel({
  ownerId,
  status,
}: {
  ownerId: string;
  status: VerificationStatus;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busyOn, setBusyOn] = React.useState<Decision | null>(null);

  const decisions = AVAILABLE[status] ?? [];

  function run(decision: Decision) {
    setBusyOn(decision);
    setError(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.append("ownerId", ownerId);
        fd.append("note", note);
        const res = await decideOwnerAction(decision, null, fd);
        if (res.ok) {
          setNote("");
          router.refresh();
        } else {
          setError(res.error);
        }
      } catch {
        setError("Something went wrong — but the change may have applied. Refresh to check.");
      } finally {
        setBusyOn(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="kyc-note" className="text-sm font-medium">
          Note{" "}
          <span className="font-normal text-muted-foreground">
            (required for reject / resubmit / revoke — shown to the owner)
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
        {decisions.map((d) => {
          const meta = META[d];
          return (
            <Button
              key={d}
              size="sm"
              variant={meta.variant}
              disabled={pending}
              onClick={() => run(d)}
            >
              {busyOn === d ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <meta.icon className="h-4 w-4" aria-hidden />
              )}
              {meta.label}
            </Button>
          );
        })}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

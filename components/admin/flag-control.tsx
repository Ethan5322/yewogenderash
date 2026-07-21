"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Flag, FlagOff, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setCampaignFlagAction, setOwnerFlagAction } from "@/app/admin/actions";

/** Admin control to raise/clear a fraud flag on a campaign or an owner. */
export function FlagControl({
  kind,
  id,
  flagged,
  reason,
}: {
  kind: "campaign" | "owner";
  id: string;
  flagged: boolean;
  reason?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const act = (next: boolean, why?: string) =>
    startTransition(async () => {
      setError(null);
      const res =
        kind === "campaign"
          ? await setCampaignFlagAction(id, next, why)
          : await setOwnerFlagAction(id, next, why);
      if (res.ok) router.refresh();
      else setError(res.error);
    });

  if (flagged) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-destructive">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Flagged as suspicious
        </p>
        {reason ? <p className="mt-1 text-xs text-destructive/90">{reason}</p> : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="mt-2"
          disabled={pending}
          onClick={() => act(false)}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlagOff className="h-4 w-4" aria-hidden />}
          Clear flag
        </Button>
        {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="text-destructive hover:text-destructive"
        disabled={pending}
        onClick={() => {
          const why = window.prompt("Reason for flagging (optional):") ?? undefined;
          act(true, why);
        }}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" aria-hidden />}
        Flag as suspicious
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

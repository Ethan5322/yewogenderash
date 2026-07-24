"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { CampaignStatus } from "@prisma/client";
import { Loader2, Check, X, PauseCircle, Flag, Archive, Star, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  decideCampaignAction,
  toggleFeaturedAction,
  deleteCampaignAction,
  type ActionResult,
} from "@/app/admin/actions";

type Decision = "approve" | "reject" | "suspend" | "complete" | "archive";

/** Which decisions make sense from each status — mirrors the server matrix. */
const AVAILABLE: Record<CampaignStatus, Decision[]> = {
  DRAFT: [],
  PENDING_REVIEW: ["approve", "reject"],
  ACTIVE: ["suspend", "complete"],
  SUSPENDED: ["approve", "archive"],
  COMPLETED: ["archive"],
  REJECTED: ["archive"],
  ARCHIVED: [],
};

const DECISION_META: Record<
  Decision,
  { label: string; icon: React.ElementType; variant: "default" | "destructive" | "outline" | "secondary" }
> = {
  approve: { label: "Approve → Active", icon: Check, variant: "default" },
  reject: { label: "Reject", icon: X, variant: "destructive" },
  suspend: { label: "Suspend", icon: PauseCircle, variant: "destructive" },
  complete: { label: "Mark completed", icon: Flag, variant: "secondary" },
  archive: { label: "Archive", icon: Archive, variant: "outline" },
};

export function CampaignDecisionPanel({
  campaignId,
  status,
  isFeatured,
}: {
  campaignId: string;
  status: CampaignStatus;
  isFeatured: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busyOn, setBusyOn] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  const decisions = AVAILABLE[status];

  function run(fn: () => Promise<ActionResult>, key: string) {
    setBusyOn(key);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusyOn(null);
      if (res.ok) {
        setNote("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  // Permanent deletion — leaves nothing to refresh, so navigate away on success.
  function runDelete() {
    setBusyOn("delete");
    setError(null);
    startTransition(async () => {
      const res = await deleteCampaignAction(campaignId);
      setBusyOn(null);
      if (res.ok) {
        router.push("/admin/campaigns");
        router.refresh();
      } else {
        setConfirmDelete(false);
        setError(res.error);
      }
    });
  }

  const noDecisions = decisions.length === 0 && status !== "ACTIVE";

  return (
    <div className="space-y-4">
      {noDecisions ? (
        <p className="text-sm text-muted-foreground">
          No status changes available in this state.
        </p>
      ) : null}
      <div className={noDecisions ? "hidden" : undefined}>
        <label htmlFor="review-note" className="text-sm font-medium">
          Review note{" "}
          <span className="font-normal text-muted-foreground">
            (required for rejections — shown to the owner)
          </span>
        </label>
        <textarea
          id="review-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {decisions.map((d) => {
          const meta = DECISION_META[d];
          return (
            <Button
              key={d}
              size="sm"
              variant={meta.variant}
              disabled={pending}
              onClick={() =>
                run(() => {
                  const fd = new FormData();
                  fd.append("campaignId", campaignId);
                  fd.append("note", note);
                  return decideCampaignAction(d, null, fd);
                }, d)
              }
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

        {status === "ACTIVE" || isFeatured ? (
          <Button
            size="sm"
            variant={isFeatured ? "secondary" : "gold"}
            disabled={pending}
            onClick={() => run(() => toggleFeaturedAction(campaignId), "feature")}
          >
            {busyOn === "feature" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Star className="h-4 w-4" aria-hidden />
            )}
            {isFeatured ? "Remove from featured" : "Feature on home"}
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {/* Permanent deletion — always available, walled off behind a confirm. */}
      <div className="border-t border-destructive/20 pt-4">
        {confirmDelete ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3">
            <p className="flex items-start gap-2 text-sm font-medium text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Delete this campaign permanently? This cannot be undone.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="destructive"
                disabled={pending}
                onClick={runDelete}
              >
                {busyOn === "delete" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" aria-hidden />
                )}
                Yes, delete permanently
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmDelete(true);
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-destructive hover:underline"
          >
            <Trash2 className="h-4 w-4" aria-hidden />
            Delete campaign permanently
          </button>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Campaigns that have received money can&apos;t be deleted — archive
          those instead to keep the records.
        </p>
      </div>
    </div>
  );
}

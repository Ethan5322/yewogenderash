"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { PayoutStatus } from "@prisma/client";
import { Loader2, Check, X, Banknote, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  decidePayoutAction,
  sendPayoutTransferAction,
} from "@/app/admin/actions";

export function PayoutDecisionPanel({
  payoutId,
  status,
  transferStatus = null,
  transfersEnabled = false,
}: {
  payoutId: string;
  status: PayoutStatus;
  /** Provider transfer state: null, PENDING, SUCCESS or FAILED. */
  transferStatus?: string | null;
  /** CHAPA_TRANSFERS_ENABLED, resolved on the server. */
  transfersEnabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [note, setNote] = React.useState("");
  const [reference, setReference] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [busyOn, setBusyOn] = React.useState<string | null>(null);

  /**
   * Only offered when transfers are on AND nothing has been attempted. Once a
   * transfer exists in any state the button disappears: SUCCESS needs nothing,
   * PENDING must never be re-sent, and FAILED needs a human to look at the bank
   * details rather than press the same button again.
   */
  const canSendTransfer =
    transfersEnabled && status === "APPROVED" && transferStatus === null;

  function sendTransfer() {
    setBusyOn("send");
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const res = await sendPayoutTransferAction(payoutId);
      setBusyOn(null);
      if (res.ok) {
        // A PENDING outcome comes back ok:true with a warning to read, not an
        // error — the instruction was sent, it just is not confirmed.
        setNotice(res.message);
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

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
          {/* Automatic transfer, when it is switched on. Offered ABOVE the manual
              route because it is the one that records what the bank actually did
              — "Mark paid" only records what an admin believes. */}
          {canSendTransfer ? (
            <>
              <Button
                size="sm"
                disabled={pending}
                onClick={sendTransfer}
                title="Send this payout to the fundraiser's bank via Chapa"
              >
                {busyOn === "send" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Send className="h-3.5 w-3.5" aria-hidden />
                )}
                Send transfer
              </Button>
              {notice ? (
                <p className="text-xs text-warning">{notice}</p>
              ) : null}
              <p className="text-[11px] text-muted-foreground">
                or record a transfer you made yourself:
              </p>
            </>
          ) : null}

          {/* Already attempted: there is deliberately no retry button. A transfer
              whose outcome is unknown is settled by asking Chapa, never by
              sending a second instruction. */}
          {transferStatus === "PENDING" ? (
            <p className="text-xs text-warning">
              Transfer sent, not yet confirmed. It will be checked automatically —
              do <strong>not</strong> send it again.
            </p>
          ) : null}
          {transferStatus === "FAILED" ? (
            <p className="text-xs text-destructive">
              Transfer refused by the bank. Check the fundraiser&apos;s account
              details before trying anything else.
            </p>
          ) : null}

          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Transfer reference (required)"
            className="h-8 text-xs"
          />
          <Button
            size="sm"
            variant={canSendTransfer ? "outline" : "default"}
            disabled={pending || !reference}
            onClick={() => run("paid")}
          >
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

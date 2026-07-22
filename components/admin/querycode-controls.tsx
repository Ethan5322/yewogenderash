"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, RefreshCw, Power, PowerOff, Download, QrCode, ExternalLink } from "lucide-react";
import { CopyButton } from "@/components/admin/copy-button";
import {
  regenerateQueryCodeAction,
  setQueryCodeActiveAction,
  type ActionResult,
} from "@/app/admin/querycodes/actions";

const btn =
  "inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent disabled:opacity-60";

export function QuerycodeControls({
  campaignId,
  queryCode,
  active,
  donateUrl,
}: {
  campaignId: string;
  queryCode: string;
  active: boolean;
  donateUrl: string;
}) {
  const [pending, startTransition] = React.useTransition();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function run(key: string, fn: () => Promise<ActionResult>, confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setBusy(key);
    setError(null);
    startTransition(async () => {
      const res = await fn();
      setBusy(null);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <div className="flex flex-wrap items-center justify-end gap-1.5">
        <CopyButton value={donateUrl} label="Copy link" />

        <Link href={`/q/${queryCode}/qr`} target="_blank" className={btn}>
          <QrCode className="h-3.5 w-3.5" aria-hidden /> QR
        </Link>
        <a href={`/q/${queryCode}/qr?download=1`} className={btn}>
          <Download className="h-3.5 w-3.5" aria-hidden /> QR PNG
        </a>
        <Link href={`/q/${queryCode}`} target="_blank" className={btn}>
          <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Landing
        </Link>

        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            run(
              "toggle",
              () => setQueryCodeActiveAction(campaignId, !active),
              active
                ? "Disable this querycode? The /q link and QR will stop working until re-enabled."
                : undefined
            )
          }
        >
          {busy === "toggle" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : active ? (
            <PowerOff className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <Power className="h-3.5 w-3.5" aria-hidden />
          )}
          {active ? "Disable" : "Enable"}
        </button>

        <button
          type="button"
          className={btn}
          disabled={pending}
          onClick={() =>
            run(
              "regen",
              () => regenerateQueryCodeAction(campaignId),
              "Regenerate this querycode? The current code, its /q link and every printed QR will stop working. This can't be undone."
            )
          }
        >
          {busy === "regen" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Regenerate
        </button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

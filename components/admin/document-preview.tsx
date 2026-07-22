"use client";

import * as React from "react";
import { FileText, ExternalLink, Download, Eye, ChevronDown } from "lucide-react";
import { StatusChip } from "@/components/admin/ui";

export type DocKind = "image" | "pdf" | "other";

/**
 * A verification document row that expands in place to show the file — image
 * inline, PDF in an embedded frame — plus Open (new tab) and Download. Signed
 * URLs are short-lived; the preview loads them on demand.
 */
export function DocumentPreview({
  label,
  status,
  uploaded,
  kind,
  signedUrl,
  downloadUrl,
}: {
  label: string;
  status: string;
  uploaded: string;
  kind: DocKind;
  signedUrl: string | null;
  downloadUrl: string | null;
}) {
  const [open, setOpen] = React.useState(false);
  const canPreview = !!signedUrl && kind !== "other";

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => canPreview && setOpen((v) => !v)}
          className="flex min-w-0 items-center gap-3 text-left"
        >
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-medium">
              {label}
              {canPreview ? (
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
                  aria-hidden
                />
              ) : null}
            </p>
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              {uploaded} <StatusChip status={status} />
            </p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          {canPreview ? (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden /> {open ? "Hide" : "Preview"}
            </button>
          ) : null}
          {signedUrl ? (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden /> Open
            </a>
          ) : null}
          {downloadUrl ? (
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <Download className="h-3.5 w-3.5" aria-hidden /> Download
            </a>
          ) : null}
          {!signedUrl && !downloadUrl ? (
            <span className="text-xs text-muted-foreground">unavailable</span>
          ) : null}
        </div>
      </div>

      {open && signedUrl ? (
        <div className="mt-3 overflow-hidden rounded-lg border bg-muted/30">
          {kind === "image" ? (
            // eslint-disable-next-line @next/next/no-img-element -- signed private URL
            <img
              src={signedUrl}
              alt={label}
              className="mx-auto max-h-[28rem] w-auto object-contain"
            />
          ) : kind === "pdf" ? (
            <iframe src={signedUrl} title={label} className="h-[28rem] w-full" />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

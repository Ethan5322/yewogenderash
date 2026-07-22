"use client";

import * as React from "react";
import { Loader2, Lock, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  renderIdCardCanvas,
  downloadIdCardPng,
  downloadIdCardPdf,
  type IdCardData,
  type IdCardField,
} from "@/lib/id-card/render";

export type FundraiserIdCardProps = {
  name: string;
  /** Author/verification code, or a placeholder while pending. */
  verificationCode: string;
  issued: string;
  status: string;
  photoUrl: string | null;
  /** When false the card is shown masked (blurred + locked) and cannot be downloaded. */
  approved: boolean;
  /** Show the PNG/PDF download buttons (owner's own ID page only). */
  showDownload?: boolean;
  fields?: IdCardField[];
  /** Card subtitle line (defaults to the fundraiser wording). */
  subtitle?: string;
  /** Holder role label beside the photo (defaults to the fundraiser wording). */
  roleLabel?: string;
  /** QR target (defaults to the public author profile /a/{code}). */
  qrUrl?: string;
};

/**
 * The corporate Fundraiser ID. Rendered on a canvas so the on-screen preview is
 * pixel-identical to the downloadable PNG/PDF. Until an admin approves the
 * fundraiser the card is MASKED (blurred + locked) and downloads are disabled.
 */
export function FundraiserIdCard({
  name,
  verificationCode,
  issued,
  status,
  photoUrl,
  approved,
  showDownload = false,
  fields = [],
  subtitle = "Verified Fundraiser ID",
  roleLabel = "Verified Fundraiser",
  qrUrl,
}: FundraiserIdCardProps) {
  const [src, setSrc] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<null | "png" | "pdf">(null);

  const data: IdCardData = React.useMemo(
    () => ({
      org: "Yewogen Derash",
      subtitle,
      roleLabel,
      name,
      verificationCode,
      photoUrl: photoUrl ?? "",
      qrUrl:
        qrUrl ??
        (typeof window !== "undefined"
          ? `${window.location.origin}/a/${verificationCode}`
          : `/a/${verificationCode}`),
      issued,
      status,
      fields,
    }),
    [name, verificationCode, photoUrl, issued, status, fields, subtitle, roleLabel, qrUrl]
  );

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const canvas = await renderIdCardCanvas(data, 2);
        if (!cancelled) setSrc(canvas.toDataURL("image/png"));
      } catch {
        /* leave the skeleton */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data]);

  return (
    <div className="w-full max-w-[520px]">
      <div className="relative overflow-hidden rounded-xl shadow-xl" style={{ aspectRatio: "85.6 / 54" }}>
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element -- generated data URL
          <img
            src={src}
            alt={`Fundraiser ID for ${name}`}
            className={`h-full w-full object-cover ${approved ? "" : "blur-[6px]"}`}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
          </div>
        )}

        {/* Masked overlay until admin approval */}
        {!approved ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/45 text-center text-white">
            <Lock className="h-7 w-7" aria-hidden />
            <p className="px-4 text-sm font-semibold uppercase tracking-wide">
              Awaiting admin approval
            </p>
            <p className="max-w-[80%] text-xs text-white/80">
              Your ID is generated but locked. It unlocks for download once an
              administrator approves your verification.
            </p>
          </div>
        ) : null}
      </div>

      {showDownload ? (
        approved ? (
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              type="button"
              size="sm"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("png");
                try {
                  await downloadIdCardPng(data);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "png" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" aria-hidden />}
              Download ID (PNG)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy !== null}
              onClick={async () => {
                setBusy("pdf");
                try {
                  await downloadIdCardPdf(data);
                } finally {
                  setBusy(null);
                }
              }}
            >
              {busy === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" aria-hidden />}
              Download ID (PDF)
            </Button>
          </div>
        ) : (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" aria-hidden />
            Download unlocks after admin approval.
          </p>
        )
      ) : null}
    </div>
  );
}

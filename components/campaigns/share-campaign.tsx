"use client";

import * as React from "react";
import { Share2, Copy, Check, Send, MessageCircle, Globe } from "lucide-react";
import { useDict } from "@/lib/use-dict";

/**
 * Public "share this campaign" card. Gives donors a copyable link plus one-tap
 * sharing: the native share sheet on mobile (WhatsApp, Telegram, SMS, …) and
 * direct links to the channels Ethiopian donors use most. The URL is the
 * campaign's own public page so every share lands on the right campaign.
 */
export function ShareCampaign({ url, title }: { url: string; title: string }) {
  const dict = useDict();
  const t = dict.campaign;
  const [copied, setCopied] = React.useState(false);
  const [canNativeShare, setCanNativeShare] = React.useState(false);

  React.useEffect(() => {
    setCanNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked (insecure context / permissions) — select the text
      // so the user can copy manually.
      inputRef.current?.select();
    }
  }

  async function nativeShare() {
    try {
      await navigator.share({ title, text: title, url });
    } catch {
      /* user dismissed the share sheet — nothing to do */
    }
  }

  const inputRef = React.useRef<HTMLInputElement>(null);
  const enc = encodeURIComponent(url);
  const encMsg = encodeURIComponent(`${title} — ${url}`);

  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Share2 className="h-4 w-4" aria-hidden />
        {t.shareTitle}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t.shareHint}</p>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 rounded-md border border-input bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={t.shareTitle}
        />
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-success" aria-hidden /> {t.copied}
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" aria-hidden /> {t.copyLink}
            </>
          )}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {canNativeShare ? (
          <button
            type="button"
            onClick={nativeShare}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            <Share2 className="h-3.5 w-3.5" aria-hidden /> {t.shareVia}
          </button>
        ) : null}
        <a
          href={`https://wa.me/?text=${encMsg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
        </a>
        <a
          href={`https://t.me/share/url?url=${enc}&text=${encodeURIComponent(title)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <Send className="h-3.5 w-3.5" aria-hidden /> Telegram
        </a>
        <a
          href={`https://www.facebook.com/sharer/sharer.php?u=${enc}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <Globe className="h-3.5 w-3.5" aria-hidden /> Facebook
        </a>
      </div>
    </div>
  );
}

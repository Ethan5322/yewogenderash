"use client";

import * as React from "react";
import { Share2, Printer, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Post-donation actions: share the campaign (native share sheet with a
 * clipboard fallback) and print/save the receipt as a PDF.
 */
export function ReceiptActions({
  campaignSlug,
  campaignTitle,
}: {
  campaignSlug: string;
  campaignTitle: string;
}) {
  const [copied, setCopied] = React.useState(false);

  async function share() {
    const url = `${window.location.origin}/campaigns/${campaignSlug}`;
    const data = {
      title: campaignTitle,
      text: `I just donated to "${campaignTitle}" on Yewogen Derash. Join me:`,
      url,
    };
    if (navigator.share) {
      try {
        await navigator.share(data);
        return;
      } catch {
        /* user cancelled or unsupported — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="mt-4 flex flex-col justify-center gap-2 sm:flex-row">
      <Button type="button" variant="outline" onClick={share}>
        {copied ? (
          <>
            <Check className="h-4 w-4 text-success" aria-hidden /> Link copied
          </>
        ) : (
          <>
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </>
        )}
      </Button>
      <Button type="button" variant="outline" onClick={() => window.print()}>
        <Printer className="h-4 w-4" aria-hidden /> Download receipt
      </Button>
    </div>
  );
}

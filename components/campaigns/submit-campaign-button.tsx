"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitCampaignAction } from "@/app/dashboard/campaigns/actions";

/** Owner: send a DRAFT (or edited REJECTED) campaign to admin review. */
export function SubmitCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await submitCampaignAction(campaignId);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" aria-hidden />
        )}
        Submit for review
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

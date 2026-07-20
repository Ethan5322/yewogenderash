"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, CheckCircle2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  postCampaignUpdateAction,
  type ActionResult,
} from "@/app/dashboard/campaigns/actions";

export function PostUpdateForm({ campaignId }: { campaignId: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    postCampaignUpdateAction,
    null
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="campaignId" value={campaignId} />
      <div>
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <Input
          id="title"
          name="title"
          className="mt-1.5"
          placeholder="e.g. Surgery scheduled for next week"
          maxLength={120}
        />
      </div>
      <div>
        <label htmlFor="body" className="text-sm font-medium">Update</label>
        <textarea
          id="body"
          name="body"
          rows={4}
          maxLength={5000}
          placeholder="Share progress with your donors…"
          className="mt-1.5 w-full rounded-md border border-input bg-background p-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Update posted — donors can see it now
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden />}
        Post update
      </Button>
    </form>
  );
}

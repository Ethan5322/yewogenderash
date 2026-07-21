"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { replyToOwnerAction, type ActionResult } from "@/app/admin/messages/actions";

export function MessageReplyForm({ ownerId }: { ownerId: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    replyToOwnerAction,
    null
  );
  const formRef = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
      router.refresh();
    }
  }, [state, router]);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="ownerId" value={ownerId} />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={3}
        placeholder="Reply to this fundraiser…"
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden />}
        Send reply
      </Button>
    </form>
  );
}

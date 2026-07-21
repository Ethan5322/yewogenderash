"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  sendOwnerMessageAction,
  type ActionResult,
} from "@/app/dashboard/messages/actions";

export function MessageComposer() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    sendOwnerMessageAction,
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
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={3}
        placeholder="Write a message to the Yewogen Derash team…"
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden />}
        Send message
      </Button>
    </form>
  );
}

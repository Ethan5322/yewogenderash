"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { broadcastNoticeAction, type ActionResult } from "@/app/admin/messages/actions";

export function BroadcastForm() {
  const router = useRouter();
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    broadcastNoticeAction,
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
      <Input name="subject" required maxLength={160} placeholder="Notice subject" />
      <textarea
        name="body"
        required
        maxLength={4000}
        rows={4}
        placeholder="Write a notice sent to every fundraiser at once…"
        className="w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm text-success">Notice sent to all fundraisers.</p>
      ) : null}
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" aria-hidden />}
        Send notice to all fundraisers
      </Button>
    </form>
  );
}

"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  saveWhatsappPrefsAction,
  type ActionResult,
} from "@/app/dashboard/settings/actions";

export function WhatsappPrefsForm({
  initial,
}: {
  initial: {
    whatsappAlerts: boolean;
    whatsappPhone: string;
    callmebotApiKey: string;
  };
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveWhatsappPrefsAction,
    null
  );
  const [enabled, setEnabled] = React.useState(initial.whatsappAlerts);

  return (
    <form action={action} className="space-y-4">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="whatsappAlerts"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-input accent-primary"
        />
        <span className="font-medium">
          Send me a WhatsApp alert for each successful donation
        </span>
      </label>

      {enabled ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="whatsappPhone" className="text-sm font-medium">
              WhatsApp number
            </label>
            <Input
              id="whatsappPhone"
              name="whatsappPhone"
              defaultValue={initial.whatsappPhone}
              placeholder="+2519..."
              className="mt-1.5"
            />
          </div>
          <div>
            <label htmlFor="callmebotApiKey" className="text-sm font-medium">
              CallMeBot API key
            </label>
            <Input
              id="callmebotApiKey"
              name="callmebotApiKey"
              defaultValue={initial.callmebotApiKey}
              placeholder="123456"
              className="mt-1.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Get a free key by messaging the CallMeBot WhatsApp bot — see{" "}
              <a
                href="https://www.callmebot.com/blog/free-api-whatsapp-messages/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                their setup guide
              </a>
              .
            </p>
          </div>
        </div>
      ) : (
        <>
          <input type="hidden" name="whatsappPhone" value={initial.whatsappPhone} />
          <input type="hidden" name="callmebotApiKey" value={initial.callmebotApiKey} />
        </>
      )}

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Settings saved
        </p>
      ) : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Save settings
      </Button>
    </form>
  );
}

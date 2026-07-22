"use client";

import * as React from "react";
import { useActionState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  submitSupportMessageAction,
  type ActionResult,
} from "@/app/(public)/support/actions";

const inputClass =
  "h-11 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

/**
 * Contact / report message form. Really submits to the server — the message is
 * stored in the Support inbox and an administrator is notified.
 */
export function MessageForm({
  variant = "contact",
}: {
  variant?: "contact" | "report";
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    submitSupportMessageAction,
    null
  );

  if (state?.ok) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success/10 p-5">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-success" aria-hidden />
        <div>
          <p className="font-medium">Thank you — your message was sent.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {variant === "report"
              ? "Our trust & safety team has received your report and will review it."
              : "We've received your message and will get back to you by email."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="type" value={variant === "report" ? "REPORT" : "CONTACT"} />
      {/* Honeypot — hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="text-sm font-medium">Your name</label>
          <input id="name" name="name" required className={`mt-1.5 ${inputClass}`} />
        </div>
        <div>
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input id="email" name="email" type="email" required className={`mt-1.5 ${inputClass}`} />
        </div>
      </div>

      {variant === "report" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="code" className="text-sm font-medium">
              Campaign querycode or link
            </label>
            <input id="code" name="code" className={`mt-1.5 ${inputClass}`} />
          </div>
          <div>
            <label htmlFor="reason" className="text-sm font-medium">Reason</label>
            <select id="reason" name="reason" className={`mt-1.5 ${inputClass}`}>
              <option>Suspected fraud</option>
              <option>Misleading information</option>
              <option>Duplicate campaign</option>
              <option>Inappropriate content</option>
              <option>Other</option>
            </select>
          </div>
        </div>
      ) : null}

      <div>
        <label htmlFor="message" className="text-sm font-medium">
          {variant === "report" ? "What did you notice?" : "Message"}
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="mt-1.5 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <Button type="submit" size="lg" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {variant === "report" ? "Submit report" : "Send message"}
      </Button>
    </form>
  );
}

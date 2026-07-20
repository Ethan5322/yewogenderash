"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveContentAction, type ActionResult } from "@/app/admin/content/actions";

/**
 * Generic JSON editor for a registered content block. The value is validated
 * server-side against the key's schema, so a bad edit is rejected with a
 * message rather than corrupting the public page.
 */
export function ContentEditorForm({
  contentKey,
  initialValue,
  defaultValue,
}: {
  contentKey: string;
  initialValue: string;
  defaultValue: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveContentAction,
    null
  );
  const [value, setValue] = React.useState(initialValue);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="key" value={contentKey} />

      <div>
        <label htmlFor="value" className="text-sm font-medium">
          Content (JSON)
        </label>
        <textarea
          id="value"
          name="value"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          spellCheck={false}
          rows={20}
          className="mt-1.5 w-full rounded-md border border-input bg-background p-3 font-mono text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Edit the JSON above. It is validated against this block&apos;s schema
          before saving.
        </p>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setValue(defaultValue)}
          disabled={pending}
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Reset to default
        </Button>
      </div>
    </form>
  );
}

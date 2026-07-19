"use client";

import * as React from "react";
import { useTransition } from "react";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { submitForReviewAction } from "@/app/(public)/start/(wizard)/actions";

export function SubmitReview({ disabled }: { disabled: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div>
      <Button
        size="lg"
        disabled={disabled || pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await submitForReviewAction();
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Submit for review
      </Button>
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

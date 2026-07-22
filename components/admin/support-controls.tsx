"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setSupportStatusAction } from "@/app/admin/support/actions";

export function SupportResolveButton({
  id,
  status,
}: {
  id: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const resolved = status === "RESOLVED";

  return (
    <Button
      type="button"
      size="sm"
      variant={resolved ? "ghost" : "outline"}
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSupportStatusAction(id, resolved ? "OPEN" : "RESOLVED");
          router.refresh();
        })
      }
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : resolved ? (
        <RotateCcw className="h-4 w-4" aria-hidden />
      ) : (
        <Check className="h-4 w-4" aria-hidden />
      )}
      {resolved ? "Reopen" : "Mark resolved"}
    </Button>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Globe, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { setPostStatusAction, deletePostAction } from "@/app/admin/blog/actions";

export function BlogPostControls({
  postId,
  published,
}: {
  postId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant={published ? "outline" : "default"}
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await setPostStatusAction(postId, !published);
            if (res.ok) router.refresh();
            else setError(res.error);
          })
        }
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : published ? (
          <EyeOff className="h-4 w-4" aria-hidden />
        ) : (
          <Globe className="h-4 w-4" aria-hidden />
        )}
        {published ? "Unpublish" : "Publish"}
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={pending}
        className="text-destructive hover:text-destructive"
        onClick={() =>
          startTransition(async () => {
            if (!confirm("Delete this post permanently?")) return;
            setError(null);
            await deletePostAction(postId);
          })
        }
      >
        <Trash2 className="h-4 w-4" aria-hidden />
        Delete
      </Button>

      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

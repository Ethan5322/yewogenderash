"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createPostAction,
  updatePostAction,
  type ActionResult,
} from "@/app/admin/blog/actions";

type Initial = {
  title: string;
  excerpt: string;
  body: string;
  coverImageUrl: string;
};

export function BlogEditor({
  postId,
  initial,
}: {
  postId?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  // Bind the post id for the update variant; create takes (prev, formData).
  const action = postId
    ? updatePostAction.bind(null, postId)
    : createPostAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  React.useEffect(() => {
    if (state?.ok && !postId && state.id) {
      router.push(`/admin/blog/${state.id}`);
    } else if (state?.ok) {
      router.refresh();
    }
  }, [state, postId, router]);

  return (
    <form action={formAction} className="space-y-5">
      <div>
        <label htmlFor="title" className="text-sm font-medium">Title</label>
        <Input id="title" name="title" defaultValue={initial?.title} required maxLength={160} className="mt-1.5" />
      </div>
      <div>
        <label htmlFor="excerpt" className="text-sm font-medium">
          Summary <span className="text-muted-foreground">(shown on the blog list)</span>
        </label>
        <textarea
          id="excerpt"
          name="excerpt"
          defaultValue={initial?.excerpt}
          required
          maxLength={300}
          rows={2}
          className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>
      <div>
        <label htmlFor="coverImageUrl" className="text-sm font-medium">
          Cover image URL <span className="text-muted-foreground">(optional)</span>
        </label>
        <Input id="coverImageUrl" name="coverImageUrl" type="url" defaultValue={initial?.coverImageUrl} maxLength={500} className="mt-1.5" />
      </div>
      <div>
        <label htmlFor="body" className="text-sm font-medium">Body</label>
        <textarea
          id="body"
          name="body"
          defaultValue={initial?.body}
          required
          maxLength={50_000}
          rows={16}
          className="mt-1.5 w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-sm leading-relaxed shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Plain text with blank lines between paragraphs.
        </p>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}
      {state?.ok ? <p className="text-sm text-success">Saved.</p> : null}

      <Button type="submit" disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" aria-hidden />}
        {postId ? "Save changes" : "Create draft"}
      </Button>
    </form>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, RotateCcw, UserCheck, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  setSupportStatusAction,
  assignSupportAction,
  saveSupportNoteAction,
} from "@/app/admin/support/actions";

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

/** Case handoff + internal note — lets compliance pass a case to finance/support. */
export function SupportCaseControls({
  id,
  assignedToId,
  note,
  admins,
}: {
  id: string;
  assignedToId: string | null;
  note: string | null;
  admins: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = React.useTransition();
  const [draft, setDraft] = React.useState(note ?? "");
  const [saved, setSaved] = React.useState(false);

  const dirty = draft.trim() !== (note ?? "").trim();

  return (
    <div className="mt-3 flex flex-wrap items-start gap-3 border-t pt-3">
      <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <UserCheck className="h-3.5 w-3.5" aria-hidden /> Assigned to
        <select
          value={assignedToId ?? ""}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              await assignSupportAction(id, e.target.value || null);
              router.refresh();
            })
          }
          className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <option value="">Unassigned</option>
          {admins.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex min-w-[16rem] flex-1 items-start gap-2">
        <textarea
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          rows={1}
          maxLength={2000}
          placeholder="Internal note (admins only)…"
          className="min-h-8 flex-1 rounded-md border border-input bg-background px-2 py-1.5 text-xs shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() =>
            start(async () => {
              await saveSupportNoteAction(id, draft);
              setSaved(true);
              router.refresh();
            })
          }
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" aria-hidden />}
          {saved && !dirty ? "Saved" : "Save note"}
        </Button>
      </div>
    </div>
  );
}

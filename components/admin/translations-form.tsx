"use client";

import { useActionState } from "react";
import { Loader2, Save, CheckCircle2, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  saveTranslationsAction,
  type SaveResult,
} from "@/app/admin/translations/actions";

type Row = { path: string; en: string; am: string; edited: boolean };
type Section = { name: string; rows: Row[] };

export function TranslationsForm({
  sections,
  editedCount,
}: {
  sections: Section[];
  editedCount: number;
}) {
  const [state, action, pending] = useActionState<SaveResult | null, FormData>(
    saveTranslationsAction,
    null
  );

  return (
    <form action={action}>
      <div className="sticky top-14 z-10 -mx-4 mb-4 flex items-center justify-between gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <p className="text-sm text-muted-foreground">
          <Languages className="mr-1 inline h-4 w-4" aria-hidden />
          {editedCount} custom Amharic override{editedCount === 1 ? "" : "s"} saved
        </p>
        <div className="flex items-center gap-3">
          {state?.ok ? (
            <span className="inline-flex items-center gap-1.5 text-sm text-success">
              <CheckCircle2 className="h-4 w-4" aria-hidden /> Saved ({state.count})
            </span>
          ) : state && !state.ok ? (
            <span className="text-sm text-destructive">{state.error}</span>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" aria-hidden />}
            Save translations
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => (
          <details key={section.name} className="rounded-xl border bg-card shadow-sm" open={section.name === "home"}>
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold capitalize hover:bg-accent/40">
              {section.name}{" "}
              <span className="font-normal text-muted-foreground">({section.rows.length})</span>
            </summary>
            <div className="divide-y border-t">
              {section.rows.map((row) => (
                <div key={row.path} className="grid gap-2 px-4 py-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-muted-foreground/70">{row.path}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{row.en}</p>
                  </div>
                  <div>
                    <textarea
                      name={`am.${row.path}`}
                      defaultValue={row.am}
                      rows={row.am.length > 60 ? 3 : 1}
                      dir="auto"
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    />
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </form>
  );
}

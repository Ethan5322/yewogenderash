"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDropzone } from "@/components/onboarding/file-dropzone";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { createCampaignAction, type ActionResult } from "@/app/dashboard/campaigns/actions";

const selectClass =
  "h-10 w-full rounded-md border border-input bg-card px-3 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function CampaignForm() {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createCampaignAction,
    null
  );
  const [hero, setHero] = React.useState<File | null>(null);

  return (
    <form action={action} className="space-y-6">
      <Field label="Campaign title" hint="Clear and specific — no exaggerated claims.">
        <Input name="title" required minLength={8} maxLength={90} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <select name="category" className={selectClass} defaultValue="MEDICAL">
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target amount (ETB)" hint="Whole birr, minimum 1,000.">
          <Input
            name="targetAmount"
            type="number"
            min={1000}
            max={10000000}
            step={1}
            required
          />
        </Field>
        <Field label="Location" hint="City or region (optional).">
          <Input name="location" maxLength={80} placeholder="e.g. Addis Ababa" />
        </Field>
        <Field label="End date" hint="Optional — leave empty for open-ended.">
          <Input name="endDate" type="date" />
        </Field>
      </div>

      <Field
        label="Short summary"
        hint="Shown on campaign cards. 40–300 characters."
      >
        <textarea
          name="description"
          rows={3}
          required
          minLength={40}
          maxLength={300}
          className={textareaClass}
        />
      </Field>

      <Field
        label="Full story"
        hint="The complete picture: who, why, what the funds cover, and how progress will be shared. Reviewers check this against your supporting documents."
      >
        <textarea
          name="story"
          rows={10}
          required
          minLength={120}
          className={textareaClass}
        />
      </Field>

      <FileDropzone
        name="heroImage"
        label="Hero image (optional)"
        accept="image/jpeg,image/png,image/webp"
        file={hero}
        onFileChange={setHero}
      />

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <p className="text-xs text-muted-foreground">
          Your campaign is created as a draft. Submit it for review when ready —
          it goes live only after admin approval.
        </p>
        <Button type="submit" disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" aria-hidden />
          )}
          Create draft
        </Button>
      </div>
    </form>
  );
}

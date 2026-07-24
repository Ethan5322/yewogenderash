"use client";

import * as React from "react";
import { useActionState } from "react";
import { Loader2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileDropzone } from "@/components/onboarding/file-dropzone";
import { CATEGORY_LABELS, CATEGORY_PROOF } from "@/lib/campaign-types";
import { createCampaignAction, type ActionResult } from "@/app/dashboard/campaigns/actions";
import { useDict } from "@/lib/use-dict";

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

export type CampaignFormDefaults = {
  title?: string;
  category?: string;
  targetAmount?: number | string;
  location?: string;
  endDate?: string;
  description?: string;
  story?: string;
};

export function CampaignForm({
  action = createCampaignAction,
  defaults,
  submitLabel,
  footerNote,
  currentHeroUrl,
  requireProof = false,
  requireHero = false,
}: {
  action?: (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;
  defaults?: CampaignFormDefaults;
  submitLabel?: string;
  footerNote?: string;
  currentHeroUrl?: string | null;
  /** Require a category-matched proof document (campaign creation only). */
  requireProof?: boolean;
  /** Require a public hero photo (true unless one already exists). */
  requireHero?: boolean;
}) {
  const dict = useDict();
  const t = dict.campaignForm;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );
  const [hero, setHero] = React.useState<File | null>(null);
  const [category, setCategory] = React.useState(defaults?.category ?? "MEDICAL");
  const [proof, setProof] = React.useState<File | null>(null);
  const proofSpec = CATEGORY_PROOF[category as keyof typeof CATEGORY_PROOF] ?? CATEGORY_PROOF.OTHER;
  const proofMissing = requireProof && !proof;
  // A public photo must end up on the campaign: needed when required and neither
  // a new file is chosen nor one already exists.
  const heroMissing = requireHero && !hero && !currentHeroUrl;

  return (
    <form action={formAction} className="space-y-6">
      <p className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm text-foreground/80">
        {t.writeHint}
      </p>

      <Field label={t.title} hint={t.titleHint}>
        <Input name="title" required minLength={8} maxLength={90} defaultValue={defaults?.title} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.category}>
          <select
            name="category"
            className={selectClass}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {Object.keys(CATEGORY_LABELS).map((value) => (
              <option key={value} value={value}>
                {dict.categories[value as keyof typeof dict.categories]}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t.target} hint={t.targetHint}>
          <Input
            name="targetAmount"
            type="number"
            min={1000}
            max={10000000}
            step={1}
            required
            defaultValue={defaults?.targetAmount}
          />
        </Field>
        <Field label={t.location} hint={t.locationHint}>
          <Input name="location" maxLength={80} placeholder={t.locationPlaceholder} defaultValue={defaults?.location} />
        </Field>
        <Field label={t.endDate} hint={t.endDateHint}>
          <Input name="endDate" type="date" defaultValue={defaults?.endDate} />
        </Field>
      </div>

      <Field label={t.summary} hint={t.summaryHint}>
        <textarea
          name="description"
          rows={3}
          required
          minLength={40}
          maxLength={300}
          className={textareaClass}
          defaultValue={defaults?.description}
        />
      </Field>

      <Field label={t.story} hint={t.storyHint}>
        <textarea
          name="story"
          rows={10}
          required
          minLength={120}
          className={textareaClass}
          defaultValue={defaults?.story}
        />
      </Field>

      {requireProof ? (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm font-semibold">
            {proofSpec.label} <span className="text-destructive">*</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {proofSpec.hint} Required to verify this specific campaign — reviewed
            privately by administrators before it can go live. Image or PDF.
          </p>
          <div className="mt-3">
            <FileDropzone
              name="proofDocument"
              label={t.uploadProof}
              accept="image/jpeg,image/png,image/webp,application/pdf"
              maxImageDimension={2200}
              file={proof}
              onFileChange={setProof}
            />
          </div>
        </div>
      ) : null}

      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
        <p className="text-sm font-semibold">
          {currentHeroUrl ? t.heroReplace : t.heroOptional}{" "}
          {requireHero ? <span className="text-destructive">*</span> : null}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">{t.heroPublicHint}</p>

        {currentHeroUrl ? (
          <div className="mt-3">
            <p className="text-xs font-medium">{t.currentHero}</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- user upload on arbitrary host */}
            <img
              src={currentHeroUrl}
              alt="Current public photo"
              className="mt-1.5 h-32 w-full max-w-sm rounded-lg border object-cover"
            />
            <p className="mt-1 text-xs text-muted-foreground">{t.currentHeroHint}</p>
          </div>
        ) : null}

        <div className="mt-3">
          <FileDropzone
            name="heroImage"
            label={currentHeroUrl ? t.heroReplace : t.heroOptional}
            accept="image/jpeg,image/png,image/webp"
            maxImageDimension={1600}
            file={hero}
            onFileChange={setHero}
          />
        </div>
      </div>

      {state && !state.ok ? (
        <p className="text-sm text-destructive">{state.error}</p>
      ) : null}

      {proofMissing ? (
        <p className="text-sm text-warning">
          Attach the required {proofSpec.label.toLowerCase()} document to continue.
        </p>
      ) : null}

      {heroMissing ? (
        <p className="text-sm text-warning">{t.heroMissing}</p>
      ) : null}

      <div className="flex items-center justify-between gap-4 border-t pt-6">
        <p className="text-xs text-muted-foreground">{footerNote ?? t.footerNote}</p>
        <Button type="submit" disabled={pending || proofMissing || heroMissing}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Rocket className="h-4 w-4" aria-hidden />
          )}
          {submitLabel ?? t.createDraft}
        </Button>
      </div>
    </form>
  );
}

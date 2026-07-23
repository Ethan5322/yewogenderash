"use client";

import { usePathname } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import {
  WIZARD_STEPS,
  computeStepStates,
  stepKeyFromPath,
  type WizardFlags,
} from "@/components/onboarding/wizard-steps";
import { useDict } from "@/lib/use-dict";

export function WizardShell({
  flags,
  children,
}: {
  flags: WizardFlags;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const t = useDict().wizard;
  const currentKey = stepKeyFromPath(pathname ?? "");
  const states = computeStepStates(flags, currentKey);

  // Localise the step labels (keys match the dictionary).
  const steps = WIZARD_STEPS.map((s) => ({
    ...s,
    label: t.steps[s.key as keyof typeof t.steps] ?? s.label,
  }));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          {t.eyebrow}
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          {t.title}
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OnboardingStepper steps={steps} states={states} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

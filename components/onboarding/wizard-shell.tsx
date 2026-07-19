"use client";

import { usePathname } from "next/navigation";
import { OnboardingStepper } from "@/components/onboarding/onboarding-stepper";
import {
  WIZARD_STEPS,
  computeStepStates,
  stepKeyFromPath,
  type WizardFlags,
} from "@/components/onboarding/wizard-steps";

export function WizardShell({
  flags,
  children,
}: {
  flags: WizardFlags;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const currentKey = stepKeyFromPath(pathname ?? "");
  const states = computeStepStates(flags, currentKey);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Become a verified owner
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">
          Owner verification
        </h1>
      </div>

      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <OnboardingStepper steps={WIZARD_STEPS} states={states} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}

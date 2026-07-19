import type { OnboardingStepDef, StepState } from "@/components/onboarding/onboarding-stepper";

// The four owner-facing onboarding steps, in order. Kept client-safe (no server
// imports) so both the server layout and the client shell can share them.
export const WIZARD_STEPS: OnboardingStepDef[] = [
  { key: "verify", label: "Verify contact", href: "/start/verify" },
  { key: "terms", label: "Terms & consent", href: "/start/terms" },
  { key: "documents", label: "Documents & payout", href: "/start/documents" },
  { key: "review", label: "Face & submit", href: "/start/review" },
];

/** Which step completion flags the shell needs — computed server-side. */
export type WizardFlags = {
  verifyDone: boolean;
  termsDone: boolean;
  documentsDone: boolean;
  reviewDone: boolean;
};

/** Resolve each step to done / current / upcoming for the progress rail. */
export function computeStepStates(
  flags: WizardFlags,
  currentKey: string
): Record<string, StepState> {
  const done: Record<string, boolean> = {
    verify: flags.verifyDone,
    terms: flags.termsDone,
    documents: flags.documentsDone,
    review: flags.reviewDone,
  };
  const states: Record<string, StepState> = {};
  for (const step of WIZARD_STEPS) {
    states[step.key] =
      step.key === currentKey ? "current" : done[step.key] ? "done" : "upcoming";
  }
  return states;
}

/** Map a pathname to the active step key (defaults to the first step). */
export function stepKeyFromPath(pathname: string): string {
  const match = WIZARD_STEPS.find((s) => pathname.startsWith(s.href));
  return match?.key ?? WIZARD_STEPS[0].key;
}

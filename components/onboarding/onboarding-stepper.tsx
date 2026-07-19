import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepState = "done" | "current" | "upcoming";

export type OnboardingStepDef = {
  key: string;
  label: string;
  href: string;
};

/** Vertical progress rail for the owner onboarding wizard. */
export function OnboardingStepper({
  steps,
  states,
}: {
  steps: OnboardingStepDef[];
  states: Record<string, StepState>;
}) {
  return (
    <ol className="space-y-1">
      {steps.map((step, i) => {
        const state = states[step.key] ?? "upcoming";
        return (
          <li key={step.key} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold",
                  state === "done" && "border-transparent bg-primary text-primary-foreground",
                  state === "current" && "border-primary text-primary",
                  state === "upcoming" && "border-input text-muted-foreground"
                )}
              >
                {state === "done" ? <Check className="h-4 w-4" aria-hidden /> : i + 1}
              </span>
              {i < steps.length - 1 ? (
                <span
                  className={cn(
                    "my-1 h-6 w-px",
                    state === "done" ? "bg-primary" : "bg-border"
                  )}
                  aria-hidden
                />
              ) : null}
            </div>
            <span
              className={cn(
                "pt-1 text-sm",
                state === "current" ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

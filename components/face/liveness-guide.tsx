"use client";

import { ArrowLeft, ArrowRight, Eye, ScanFace, Check, ShieldCheck } from "lucide-react";
import {
  LIVENESS_SEQUENCE,
  LIVENESS_STEPS,
  type LivenessProgress,
  type LivenessStepKey,
} from "@/lib/face/liveness";
import { cn } from "@/lib/utils";

const ICONS: Record<LivenessStepKey, typeof ScanFace> = {
  centre: ScanFace,
  left: ArrowLeft,
  right: ArrowRight,
  blink: Eye,
};

/**
 * Who is being verified. Naming the subject on screen is what makes this read
 * as a controlled identity check rather than an anonymous webcam prompt, and it
 * lets the person (or the staff member operating the capture) catch immediately
 * that the wrong record is open.
 */
export function LivenessSubject({
  name,
  code,
  purpose = "Identity verification",
}: {
  /** Omitted at sign-in: naming someone before they authenticate would confirm
   *  their code exists. There, only the code they typed is echoed back. */
  name?: string;
  code?: string | null;
  purpose?: string;
}) {
  if (!name && !code) return null;
  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ShieldCheck className="h-[18px] w-[18px]" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {purpose}
        </p>
        {name ? (
          <>
            <p className="truncate font-semibold leading-tight">{name}</p>
            {code ? <p className="font-mono text-xs text-muted-foreground">{code}</p> : null}
          </>
        ) : (
          <p className="truncate font-mono font-semibold leading-tight">{code}</p>
        )}
      </div>
    </div>
  );
}

/**
 * The current instruction, shown large with a directional arrow, plus a
 * checklist of the whole sequence so the subject can see what is coming and
 * what they have already satisfied.
 */
export function LivenessGuide({
  progress,
  className,
}: {
  progress: LivenessProgress;
  className?: string;
}) {
  const doneSet = new Set(progress.done);
  const Icon = progress.current ? ICONS[progress.current] : Check;
  const isTurn = progress.current === "left" || progress.current === "right";

  return (
    <div className={cn("space-y-3", className)}>
      {/* Current instruction */}
      <div
        className={cn(
          "flex items-center justify-center gap-2.5 rounded-lg border px-4 py-3 text-center",
          progress.complete
            ? "border-success/40 bg-success/10 text-success"
            : "border-primary/40 bg-primary/5 text-foreground"
        )}
        aria-live="polite"
      >
        <Icon
          className={cn(
            "h-5 w-5 shrink-0",
            progress.complete ? "text-success" : "text-primary",
            // Nudge the arrow the way the head should move.
            isTurn && "animate-pulse"
          )}
          aria-hidden
        />
        <p className="text-sm font-semibold">{progress.instruction}</p>
      </div>

      {/* Full sequence */}
      <ol className="grid grid-cols-4 gap-1.5">
        {LIVENESS_SEQUENCE.map((key) => {
          const done = doneSet.has(key);
          const active = progress.current === key;
          const StepIcon = ICONS[key];
          return (
            <li
              key={key}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border px-1.5 py-2 text-center transition-colors",
                done && "border-success/40 bg-success/10 text-success",
                active && !done && "border-primary bg-primary/5 text-foreground",
                !done && !active && "text-muted-foreground"
              )}
              aria-current={active ? "step" : undefined}
            >
              {done ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <StepIcon className="h-4 w-4" aria-hidden />
              )}
              <span className="text-[10px] font-medium leading-tight">
                {LIVENESS_STEPS[key].short}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

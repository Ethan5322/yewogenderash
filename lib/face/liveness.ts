/**
 * The active-liveness challenge as a pure state machine.
 *
 * The subject is walked through one instruction at a time — centre your face,
 * turn left, turn right, blink — instead of being given a single combined
 * sentence. Each step has to be satisfied before the next is asked for, which
 * is both clearer for the person and stronger evidence than measuring only the
 * total range of movement (a single sweep past the camera used to pass).
 *
 * Deliberately free of React and of face-api so it can be unit-tested and
 * shared by the desktop, phone and staff capture screens. Feed it samples from
 * `detectLiveness()`; read back the current instruction and progress.
 */

export type LivenessStepKey = "centre" | "left" | "right" | "blink";

/** Fixed order the instructions are asked in. */
export const LIVENESS_SEQUENCE: readonly LivenessStepKey[] = [
  "centre",
  "left",
  "right",
  "blink",
] as const;

export const LIVENESS_STEPS: Record<
  LivenessStepKey,
  { short: string; instruction: string }
> = {
  centre: { short: "Face centred", instruction: "Look straight at the camera" },
  left: { short: "Turn left", instruction: "Slowly turn your head to your LEFT" },
  right: { short: "Turn right", instruction: "Now slowly turn your head to your RIGHT" },
  blink: { short: "Blink", instruction: "Look at the camera and blink" },
};

/**
 * Sign of `faceX` (nose offset from the face-box centre, normalised by box
 * width) when the subject turns to their own LEFT.
 *
 * The preview is not mirrored, so the camera sees the subject as another person
 * would: turning to their own left swings the nose toward the right of the
 * image, i.e. a POSITIVE offset. If the prompts read inverted on a real device,
 * flip this one constant — nothing else needs to change.
 */
export const LEFT_TURN_FACEX_SIGN = 1;

/** Thresholds, kept together so they can be tuned in one place. */
export const LIVENESS_THRESHOLDS = {
  /** |faceX| must be within this to count as looking straight ahead. */
  centre: 0.1,
  /** |faceX| must reach this to count as a deliberate turn. */
  turn: 0.14,
  /** Eye-aspect ratio below this = eye shut... */
  blinkClosed: 0.2,
  /** ...and above this again = re-opened, which completes a blink. */
  blinkOpen: 0.28,
};

export type LivenessSample = { faceX: number; ear: number };

export type LivenessProgress = {
  /** Step currently being asked for, or null once every step is satisfied. */
  current: LivenessStepKey | null;
  /** Instruction to show for the current step. */
  instruction: string;
  /** Steps satisfied so far, in sequence order. */
  done: LivenessStepKey[];
  /** True when the whole challenge has passed. */
  complete: boolean;
};

const NO_FACE_INSTRUCTION = "Position your face in the frame";

export type LivenessChallenge = {
  /** Feed one sample (or null when no face was detected). */
  feed(sample: LivenessSample | null): LivenessProgress;
  /** Current progress without advancing. */
  progress(): LivenessProgress;
  /** Start over — used when a capture fails quality checks. */
  reset(): void;
};

export function createLivenessChallenge(
  thresholds = LIVENESS_THRESHOLDS,
  leftSign = LEFT_TURN_FACEX_SIGN
): LivenessChallenge {
  let index = 0;
  // Blink needs two frames to confirm: shut, then open again.
  let eyeWasShut = false;
  let sawFace = false;

  const progress = (): LivenessProgress => {
    const current = LIVENESS_SEQUENCE[index] ?? null;
    const complete = current === null;
    return {
      current,
      instruction: complete
        ? "Hold still…"
        : sawFace
          ? LIVENESS_STEPS[current].instruction
          : NO_FACE_INSTRUCTION,
      done: LIVENESS_SEQUENCE.slice(0, index) as LivenessStepKey[],
      complete,
    };
  };

  return {
    progress,
    reset() {
      index = 0;
      eyeWasShut = false;
      sawFace = false;
    },
    feed(sample) {
      if (!sample) {
        sawFace = false;
        return progress();
      }
      sawFace = true;
      const step = LIVENESS_SEQUENCE[index];
      if (!step) return progress();

      // Signed offset in "subject's own left is positive" terms.
      const turn = sample.faceX * leftSign;

      switch (step) {
        case "centre":
          if (Math.abs(sample.faceX) <= thresholds.centre) index++;
          break;
        case "left":
          if (turn >= thresholds.turn) index++;
          break;
        case "right":
          if (turn <= -thresholds.turn) index++;
          break;
        case "blink":
          if (sample.ear < thresholds.blinkClosed) eyeWasShut = true;
          else if (eyeWasShut && sample.ear > thresholds.blinkOpen) {
            eyeWasShut = false;
            index++;
          }
          break;
      }
      return progress();
    },
  };
}

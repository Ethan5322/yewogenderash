import { describe, it, expect } from "vitest";
import {
  createLivenessChallenge,
  LIVENESS_SEQUENCE,
  LIVENESS_THRESHOLDS as T,
} from "@/lib/face/liveness";

const centre = { faceX: 0, ear: 0.35 };
const left = { faceX: T.turn + 0.05, ear: 0.35 };
const right = { faceX: -(T.turn + 0.05), ear: 0.35 };
const eyesShut = { faceX: 0, ear: T.blinkClosed - 0.05 };
const eyesOpen = { faceX: 0, ear: T.blinkOpen + 0.05 };

/** Drive the whole challenge in order and return the final progress. */
function passAll(c: ReturnType<typeof createLivenessChallenge>) {
  c.feed(centre);
  c.feed(left);
  c.feed(right);
  c.feed(eyesShut);
  return c.feed(eyesOpen);
}

describe("liveness challenge", () => {
  it("asks for one step at a time, in order", () => {
    const c = createLivenessChallenge();
    expect(c.progress().current).toBe("centre");
    expect(c.feed(centre).current).toBe("left");
    expect(c.feed(left).current).toBe("right");
    expect(c.feed(right).current).toBe("blink");
  });

  it("completes only after every step", () => {
    const c = createLivenessChallenge();
    const end = passAll(c);
    expect(end.complete).toBe(true);
    expect(end.current).toBeNull();
    expect(end.done).toEqual([...LIVENESS_SEQUENCE]);
  });

  it("does not accept a turn in the wrong direction", () => {
    const c = createLivenessChallenge();
    c.feed(centre); // now asking for LEFT
    // A right-ward turn must not satisfy the left step.
    expect(c.feed(right).current).toBe("left");
    expect(c.feed(left).current).toBe("right");
  });

  it("ignores turns that are too small to be deliberate", () => {
    const c = createLivenessChallenge();
    c.feed(centre);
    expect(c.feed({ faceX: T.turn - 0.05, ear: 0.35 }).current).toBe("left");
  });

  it("requires the eye to shut AND reopen for a blink", () => {
    const c = createLivenessChallenge();
    c.feed(centre);
    c.feed(left);
    c.feed(right);
    // Open eyes alone never completes it.
    expect(c.feed(eyesOpen).current).toBe("blink");
    c.feed(eyesShut);
    expect(c.feed(eyesOpen).complete).toBe(true);
  });

  it("reports no-face without losing progress", () => {
    const c = createLivenessChallenge();
    c.feed(centre);
    const lost = c.feed(null);
    expect(lost.current).toBe("left");
    expect(lost.instruction).toMatch(/position your face/i);
    // Still on the left step, and still satisfiable.
    expect(c.feed(left).current).toBe("right");
  });

  it("reset() starts the sequence over", () => {
    const c = createLivenessChallenge();
    passAll(c);
    c.reset();
    expect(c.progress().current).toBe("centre");
    expect(c.progress().done).toEqual([]);
  });

  it("honours a flipped left/right sign", () => {
    const flipped = createLivenessChallenge(T, -1);
    flipped.feed(centre);
    // With the sign inverted, `right`'s sample now satisfies the LEFT step.
    expect(flipped.feed(right).current).toBe("right");
  });
});

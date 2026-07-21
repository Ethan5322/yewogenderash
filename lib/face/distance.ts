// Pure face-descriptor math — safe to import on the server (no face-api / no
// TensorFlow). The browser engine (lib/face/faceapi.ts) re-uses these.

/** Distance below which two 128-D descriptors are considered the same person. */
export const MATCH_THRESHOLD = 0.6;

/** Euclidean distance between two descriptors (lower = more similar). */
export function faceDistance(a: number[] | null, b: number[] | null): number {
  if (!a || !b || a.length !== b.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const d = a[i] - b[i];
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/** True when two faces are the same person within the threshold. */
export function isSamePerson(a: number[] | null, b: number[] | null, threshold = MATCH_THRESHOLD): boolean {
  return faceDistance(a, b) < threshold;
}

/**
 * Validate an untrusted value as a face descriptor: a JSON string or array of
 * ~128 finite numbers. Returns the number[] or null.
 */
export function parseDescriptor(value: unknown): number[] | null {
  let arr: unknown = value;
  if (typeof value === "string") {
    try {
      arr = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(arr) || arr.length < 64 || arr.length > 1024) return null;
  const out: number[] = [];
  for (const n of arr) {
    const num = Number(n);
    if (!Number.isFinite(num)) return null;
    out.push(num);
  }
  return out;
}

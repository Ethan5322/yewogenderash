// Client-side image quality gate — rejects blurry, dark, or low-resolution
// uploads so the fundraiser is asked to resubmit BEFORE it reaches a reviewer
// (brief §6.3 "If image quality is poor, request resubmission").

export type QualityResult = { ok: true } | { ok: false; reason: string };

// Tunables — lenient enough not to reject decent phone photos.
const MIN_SHORT_SIDE = 400; // px on the shorter edge
const MIN_BRIGHTNESS = 35; // mean luma 0..255
const MAX_BRIGHTNESS = 240;
const MIN_SHARPNESS = 60; // Laplacian variance

/**
 * Assess an image element or canvas for resolution, exposure, and sharpness.
 * Downscales to a working size for speed, converts to luma, and measures a
 * Laplacian-variance sharpness score.
 */
export function assessImageQuality(
  source: HTMLImageElement | HTMLCanvasElement
): QualityResult {
  const srcW = source instanceof HTMLImageElement ? source.naturalWidth : source.width;
  const srcH = source instanceof HTMLImageElement ? source.naturalHeight : source.height;
  if (Math.min(srcW, srcH) < MIN_SHORT_SIDE) {
    return { ok: false, reason: "Photo is too low-resolution. Use a clearer, larger image." };
  }

  // Work at a bounded size for a fast, stable measurement.
  const scale = Math.min(1, 480 / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return { ok: true }; // can't assess → don't block
  ctx.drawImage(source, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  const luma = new Float64Array(w * h);
  let sum = 0;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    luma[p] = l;
    sum += l;
  }
  const mean = sum / (w * h);
  if (mean < MIN_BRIGHTNESS) return { ok: false, reason: "Photo is too dark. Retake in better light." };
  if (mean > MAX_BRIGHTNESS) return { ok: false, reason: "Photo is overexposed. Reduce glare and retake." };

  // Laplacian variance = sharpness. Blurry images have low variance.
  let lapSum = 0;
  let lapSqSum = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap =
        4 * luma[idx] - luma[idx - 1] - luma[idx + 1] - luma[idx - w] - luma[idx + w];
      lapSum += lap;
      lapSqSum += lap * lap;
      count++;
    }
  }
  const lapMean = lapSum / count;
  const variance = lapSqSum / count - lapMean * lapMean;
  if (variance < MIN_SHARPNESS) {
    return { ok: false, reason: "Photo looks blurry. Hold steady, focus, and retake." };
  }

  return { ok: true };
}

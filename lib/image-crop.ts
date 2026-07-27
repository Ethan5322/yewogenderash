// Browser-only image helpers. Every ID portrait — whether it came from the
// device gallery or a live camera capture — goes through the same automatic
// crop, so cards are consistent and the server never receives a 5 MB phone
// photo (Server Actions and Vercel both cap the request body).

/** Portrait aspect used on every ID card (width / height). */
export const ID_PHOTO_ASPECT = 3 / 4;

/** Share of the frame width the face should occupy — standard passport framing. */
const FACE_WIDTH_RATIO = 0.62;
/** Where the face centre sits vertically in the frame (headroom above). */
const FACE_CENTRE_Y = 0.46;

type Source = File | HTMLCanvasElement | HTMLVideoElement | ImageBitmap;

/** Draw any supported source onto a canvas so it can be measured and cropped. */
async function toCanvas(source: Source): Promise<HTMLCanvasElement | null> {
  try {
    if (source instanceof HTMLCanvasElement) return source;

    let width: number;
    let height: number;
    let drawable: CanvasImageSource;
    let bitmap: ImageBitmap | null = null;

    if (source instanceof File) {
      if (!source.type.startsWith("image/")) return null;
      // `from-image` honours EXIF so phone portraits are not rotated.
      bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
      drawable = bitmap;
      width = bitmap.width;
      height = bitmap.height;
    } else if (source instanceof ImageBitmap) {
      drawable = source;
      width = source.width;
      height = source.height;
    } else {
      drawable = source;
      width = source.videoWidth;
      height = source.videoHeight;
    }
    if (!width || !height) {
      bitmap?.close?.();
      return null;
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap?.close?.();
      return null;
    }
    ctx.drawImage(drawable, 0, 0);
    bitmap?.close?.();
    return canvas;
  } catch {
    return null;
  }
}

/**
 * The crop rectangle: 3:4, framed on the detected face when there is one
 * (head centred with natural headroom), otherwise the largest centred 3:4
 * rectangle. Always clamped inside the source image.
 */
function cropRect(
  imgW: number,
  imgH: number,
  face: { x: number; y: number; width: number; height: number } | null
) {
  let w: number;
  let h: number;
  let cx: number;
  let cy: number;

  if (face && face.width > 0) {
    w = face.width / FACE_WIDTH_RATIO;
    h = w / ID_PHOTO_ASPECT;
    cx = face.x + face.width / 2;
    cy = face.y + face.height / 2 + (0.5 - FACE_CENTRE_Y) * h;
  } else {
    w = imgW;
    h = w / ID_PHOTO_ASPECT;
    cx = imgW / 2;
    cy = imgH / 2;
  }

  // Shrink to fit the source, keeping the aspect exact.
  const scale = Math.min(1, imgW / w, imgH / h);
  w = Math.round(w * scale);
  h = Math.round(h * scale);

  // Clamp the centre so the rectangle stays inside the image.
  const x = Math.round(Math.min(Math.max(cx - w / 2, 0), imgW - w));
  const y = Math.round(Math.min(Math.max(cy - h / 2, 0), imgH - h));
  return { x, y, w, h };
}

/**
 * Auto-crop any ID portrait source to the card's 3:4 passport framing and
 * re-encode it as a modest JPEG. Face detection is best-effort: if the model
 * can't load or finds no face, it falls back to a centred crop. A non-image
 * file is returned untouched — server-side validation is still authoritative.
 */
export async function cropToIdPortrait(source: Source, maxHeight = 1000): Promise<File> {
  const fallback =
    source instanceof File ? source : new File([], "id-photo.jpg", { type: "image/jpeg" });
  const canvas = await toCanvas(source);
  if (!canvas) return fallback;

  // Best-effort face framing — never let a model failure block the upload.
  let face: { x: number; y: number; width: number; height: number } | null = null;
  try {
    const { detectBox } = await import("@/lib/face/faceapi");
    face = await detectBox(canvas);
  } catch {
    face = null;
  }

  const rect = cropRect(canvas.width, canvas.height, face);
  const h = Math.min(maxHeight, rect.h);
  const w = Math.round(h * ID_PHOTO_ASPECT);

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const ctx = out.getContext("2d");
  if (!ctx) return fallback;
  ctx.drawImage(canvas, rect.x, rect.y, rect.w, rect.h, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    out.toBlob(resolve, "image/jpeg", 0.88)
  );
  if (!blob) return fallback;

  const base =
    source instanceof File ? source.name.replace(/\.[^.]+$/, "") || "id-photo" : "id-photo";
  return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
}

/**
 * Human-readable reason a camera request failed. Browsers block getUserMedia
 * outside a secure context (anything other than https:// or localhost), which
 * is the usual surprise when testing over a LAN IP on a phone.
 */
export function cameraErrorMessage(err: unknown): string {
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return "Your browser blocks the camera on an insecure connection. Open this page over https:// (or on localhost) and try again.";
  }
  const name = (err as { name?: string } | null)?.name ?? "";
  if (name === "NotAllowedError") {
    return "Camera permission was denied. Allow camera access for this site in your browser settings, then try again.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera was found on this device. Upload a photo from your gallery instead.";
  }
  if (name === "NotReadableError") {
    return "The camera is in use by another app. Close it and try again.";
  }
  return "Couldn't start the camera. Check permissions, or upload a photo from your gallery.";
}

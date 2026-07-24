"use client";

import * as React from "react";
import { UploadCloud, FileText, X, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DEFAULT_MAX = 5 * 1024 * 1024;

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Shrink an image in the browser before it is uploaded. A phone photo is often
 * 3–5 MB, which blows past the Server Action body limit AND Vercel's 4.5 MB
 * function-body cap, so the upload "fails". Resizing to `maxDim` on the long
 * edge and re-encoding as JPEG brings it to a few hundred KB — under every
 * limit, and far quicker to load on the public page. Non-images (PDFs) and any
 * failure fall through untouched. EXIF orientation is honoured so portrait
 * photos are not rotated.
 */
async function downscaleImage(file: File, maxDim: number): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
    // Already modest in both dimensions and bytes → leave it alone.
    if (scale === 1 && file.size <= 1_200_000) {
      bmp.close?.();
      return file;
    }
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bmp.close?.();
      return file;
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close?.();
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob || blob.size >= file.size) return file; // no gain → keep original
    const base = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/**
 * Accessible file picker with drag-and-drop, client-side type/size validation,
 * and an image preview. The parent owns the selected File (controlled via
 * `onFileChange`) and submits it — server-side validation is still authoritative.
 */
export function FileDropzone({
  name,
  label,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX,
  maxImageDimension,
  file,
  onFileChange,
}: {
  name: string;
  label: string;
  accept?: string;
  maxBytes?: number;
  /** If set, images are resized to this many pixels on the long edge before
   *  upload (keeps request bodies small; ignored for non-image files). */
  maxImageDimension?: number;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(false);

  React.useEffect(() => {
    if (file && file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      setPreview(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreview(null);
  }, [file]);

  const accepted = accept.split(",").map((s) => s.trim());

  /** Mirror the chosen file into the native input so it's carried in FormData
   *  (drag-dropped files otherwise never reach the input element). */
  function syncInput(f: File | null) {
    if (!inputRef.current) return;
    if (!f) {
      inputRef.current.value = "";
      return;
    }
    const dt = new DataTransfer();
    dt.items.add(f);
    inputRef.current.files = dt.files;
  }

  async function validateAndSet(f: File | null) {
    setError(null);
    if (!f) {
      syncInput(null);
      onFileChange(null);
      return;
    }
    if (accepted.length && !accepted.includes(f.type)) {
      setError("Unsupported file type. Use a JPG, PNG, WEBP, or PDF.");
      syncInput(null);
      return;
    }
    if (f.size > maxBytes) {
      setError(`File is too large. Maximum ${humanSize(maxBytes)}.`);
      syncInput(null);
      return;
    }
    // Resize large images before they enter the form so the upload body stays
    // small. onFileChange only fires with the FINAL file, so a required-photo
    // submit guard stays disabled until the optimised file is ready.
    let finalFile = f;
    if (maxImageDimension && f.type.startsWith("image/")) {
      setProcessing(true);
      try {
        finalFile = await downscaleImage(f, maxImageDimension);
      } finally {
        setProcessing(false);
      }
    }
    syncInput(finalFile);
    onFileChange(finalFile);
  }

  return (
    <div>
      <span className="text-sm font-medium">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          validateAndSet(e.dataTransfer.files?.[0] ?? null);
        }}
        className={cn(
          "mt-1.5 rounded-lg border border-dashed p-4 transition-colors",
          dragging ? "border-primary bg-accent/50" : "border-input"
        )}
      >
        {processing ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <UploadCloud className="h-5 w-5 animate-pulse" aria-hidden />
            Optimising image…
          </div>
        ) : file ? (
          <div className="flex items-center gap-3">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
              <img
                src={preview}
                alt=""
                className="h-14 w-14 shrink-0 rounded object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-accent text-accent-foreground">
                {file.type.startsWith("image/") ? (
                  <ImageIcon className="h-6 w-6" aria-hidden />
                ) : (
                  <FileText className="h-6 w-6" aria-hidden />
                )}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-muted-foreground">{humanSize(file.size)}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                onFileChange(null);
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-1.5 py-4 text-center"
          >
            <UploadCloud className="h-7 w-7 text-muted-foreground" aria-hidden />
            <span className="text-sm font-medium text-foreground">
              Click to upload or drag &amp; drop
            </span>
            <span className="text-xs text-muted-foreground">
              JPG, PNG, WEBP or PDF · up to {humanSize(maxBytes)}
            </span>
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept={accept}
          className="sr-only"
          onChange={(e) => validateAndSet(e.target.files?.[0] ?? null)}
        />
      </div>
      {error ? <p className="mt-1.5 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}

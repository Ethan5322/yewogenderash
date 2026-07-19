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
 * Accessible file picker with drag-and-drop, client-side type/size validation,
 * and an image preview. The parent owns the selected File (controlled via
 * `onFileChange`) and submits it — server-side validation is still authoritative.
 */
export function FileDropzone({
  name,
  label,
  accept = DEFAULT_ACCEPT,
  maxBytes = DEFAULT_MAX,
  file,
  onFileChange,
}: {
  name: string;
  label: string;
  accept?: string;
  maxBytes?: number;
  file: File | null;
  onFileChange: (file: File | null) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);

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

  function validateAndSet(f: File | null) {
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
    syncInput(f);
    onFileChange(f);
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
        {file ? (
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

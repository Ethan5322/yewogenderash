"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadIdPhotoAction } from "@/app/dashboard/id/actions";
import { describeFace } from "@/lib/face/faceapi";
import { assessImageQuality } from "@/lib/face/quality";

// Output portrait size (3:4) — matches the ID-card portrait slot.
const OUT_W = 600;
const OUT_H = 800;

/**
 * Pick a photo from the gallery, auto-crop it to a centered 3:4 portrait on a
 * canvas, preview it, and upload. The crop happens entirely in the browser so
 * the server only ever receives the final ID portrait.
 */
export function IdPhotoUpload({ hasPhoto }: { hasPhoto: boolean }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setDone(false);
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file.");
      return;
    }

    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      // Center-crop the source to a 3:4 aspect, then scale to OUT_W×OUT_H.
      const targetRatio = OUT_W / OUT_H;
      const srcRatio = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > targetRatio) {
        // too wide → crop sides
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
        // too tall → crop top/bottom
        sh = img.width / targetRatio;
        sy = (img.height - sh) / 2;
      }
      const canvas = document.createElement("canvas");
      canvas.width = OUT_W;
      canvas.height = OUT_H;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Could not process the image.");
        URL.revokeObjectURL(url);
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT_W, OUT_H);
      // Reject blurry/dark/low-res photos before they are used on the ID.
      const quality = assessImageQuality(canvas);
      if (!quality.ok) {
        setError(quality.reason);
        URL.revokeObjectURL(url);
        return;
      }
      canvas.toBlob(
        (b) => {
          if (b) {
            setBlob(b);
            setPreview(canvas.toDataURL("image/jpeg", 0.9));
          }
          URL.revokeObjectURL(url);
        },
        "image/jpeg",
        0.9
      );
    };
    img.onerror = () => {
      setError("Could not read that image.");
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  async function onSave() {
    if (!blob) return;
    setPending(true);
    setError(null);
    const fd = new FormData();
    fd.append("photo", blob, "id-photo.jpg");
    // Detect the face in the ID photo so the backend can match it to the live
    // biometric capture. Best-effort — a photo with no detectable face still
    // uploads (the match just stays unknown).
    try {
      const bitmap = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext("2d")?.drawImage(bitmap, 0, 0);
      const descriptor = await describeFace(c);
      if (descriptor) fd.append("descriptor", JSON.stringify(descriptor));
    } catch {
      /* no descriptor — upload proceeds without a match */
    }
    const res = await uploadIdPhotoAction(null, fd);
    setPending(false);
    if (res.ok) {
      setDone(true);
      setBlob(null);
      setPreview(null);
      router.refresh();
    } else {
      setError(res.error);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview data URL
          <img
            src={preview}
            alt="ID photo preview"
            className="aspect-[3/4] w-24 rounded-lg border object-cover"
          />
        ) : null}
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
            <ImageUp className="h-4 w-4" aria-hidden />
            {hasPhoto ? "Choose a new photo" : "Choose photo from gallery"}
            <input type="file" accept="image/*" className="hidden" onChange={onFile} />
          </label>
          <p className="text-xs text-muted-foreground">
            Auto-cropped to a portrait. JPG/PNG/WebP, up to 5 MB.
          </p>
        </div>
      </div>

      {blob ? (
        <Button type="button" size="sm" onClick={onSave} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" aria-hidden />}
          Save ID photo
        </Button>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {done ? <p className="text-sm text-success">ID photo saved.</p> : null}
    </div>
  );
}

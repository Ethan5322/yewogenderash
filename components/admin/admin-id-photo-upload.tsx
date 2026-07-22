"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Upload, ImageUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadAdminPhotoAction } from "@/app/admin/id/actions";
import { describeFace } from "@/lib/face/faceapi";

const OUT_W = 600;
const OUT_H = 800;

/**
 * Admin staff biometric enrolment: pick a photo, auto-crop to a 3:4 portrait in
 * the browser, compute a face descriptor when possible, and save. The photo
 * becomes the portrait on the admin's staff ID.
 */
export function AdminIdPhotoUpload({ hasPhoto }: { hasPhoto: boolean }) {
  const router = useRouter();
  const [preview, setPreview] = React.useState<string | null>(null);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
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
      const targetRatio = OUT_W / OUT_H;
      const srcRatio = img.width / img.height;
      let sx = 0, sy = 0, sw = img.width, sh = img.height;
      if (srcRatio > targetRatio) {
        sw = img.height * targetRatio;
        sx = (img.width - sw) / 2;
      } else {
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
    try {
      const bitmap = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = bitmap.width;
      c.height = bitmap.height;
      c.getContext("2d")?.drawImage(bitmap, 0, 0);
      const descriptor = await describeFace(c);
      if (descriptor) fd.append("descriptor", JSON.stringify(descriptor));
    } catch {
      /* no descriptor — enrolment proceeds with the photo only */
    }
    const res = await uploadAdminPhotoAction(null, fd);
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
            alt="Staff photo preview"
            className="aspect-[3/4] w-24 rounded-lg border object-cover"
          />
        ) : null}
        <div className="space-y-2">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent">
            <ImageUp className="h-4 w-4" aria-hidden />
            {hasPhoto ? "Replace photo / re-enrol" : "Add photo & enrol biometric"}
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
          Save & enrol
        </Button>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {done ? <p className="text-sm text-success">Biometric enrolled and photo saved.</p> : null}
    </div>
  );
}

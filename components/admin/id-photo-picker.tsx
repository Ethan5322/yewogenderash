"use client";

import * as React from "react";
import { Camera, ImagePlus, Loader2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cropToIdPortrait, cameraErrorMessage } from "@/lib/image-crop";

/**
 * Pick an ID portrait from the device gallery OR take one with the camera.
 * Either way the image is auto-cropped to the card's 3:4 passport framing
 * (centred on the detected face) before it reaches the parent — the caller
 * never has to think about aspect ratios.
 */
export function IdPhotoPicker({
  photoUrl,
  onPhoto,
  disabled = false,
  hint,
}: {
  /** Currently stored portrait, shown until a new one is chosen. */
  photoUrl: string | null;
  /** Receives the cropped, ready-to-upload file. */
  onPhoto: (file: File) => void | Promise<void>;
  disabled?: boolean;
  hint?: string;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [mode, setMode] = React.useState<"idle" | "camera">("idle");
  const [working, setWorking] = React.useState(false);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  React.useEffect(() => () => stop(), [stop]);
  React.useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  /** Crop → preview → hand to the parent. */
  async function accept(source: File | HTMLVideoElement) {
    setWorking(true);
    setError(null);
    try {
      const file = await cropToIdPortrait(source);
      if (!file.size) {
        setError("Couldn't read that image. Try another photo.");
        return;
      }
      const url = URL.createObjectURL(file);
      setPreview((old) => {
        if (old) URL.revokeObjectURL(old);
        return url;
      });
      await onPhoto(file);
    } catch {
      setError("Couldn't process that image. Try again.");
    } finally {
      setWorking(false);
    }
  }

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch (err) {
      setError(cameraErrorMessage(err));
    }
  }

  async function shoot() {
    const video = videoRef.current;
    if (!video) return;
    await accept(video);
    stop();
    setMode("idle");
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (picked) await accept(picked);
  }

  const shown = preview ?? photoUrl;

  if (mode === "camera") {
    return (
      <div className="space-y-2">
        <div className="relative mx-auto w-40 overflow-hidden rounded-lg border bg-muted">
          <video ref={videoRef} playsInline muted className="aspect-[3/4] w-full object-cover" />
          {/* Framing guide — head inside the oval keeps the auto-crop natural. */}
          <div className="pointer-events-none absolute inset-0 flex items-start justify-center pt-3">
            <div className="h-[62%] w-[62%] rounded-[50%] border-2 border-white/70" />
          </div>
        </div>
        <p className="text-center text-xs text-muted-foreground">
          Face the camera, head inside the oval.
        </p>
        {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              stop();
              setMode("idle");
            }}
          >
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={shoot} disabled={working}>
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" aria-hidden />
            )}
            Take photo
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-3">
        <div className="h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-md border bg-muted">
          {shown ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote/blob portrait
            <img src={shown} alt="ID portrait" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ScanFace className="h-5 w-5" aria-hidden />
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-1.5">
            <label className="inline-flex">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={onPick}
                disabled={disabled || working}
              />
              <span
                className={`inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-background px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent ${
                  disabled || working ? "pointer-events-none opacity-60" : "cursor-pointer"
                }`}
              >
                {working ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="h-3.5 w-3.5" aria-hidden />
                )}
                {shown ? "Change photo" : "Upload from gallery"}
              </span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={startCamera}
              disabled={disabled || working}
            >
              <Camera className="h-3.5 w-3.5" aria-hidden /> Take photo
            </Button>
            {preview ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={startCamera}
                disabled={disabled || working}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Retake
              </Button>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {hint ??
              "Gallery or camera — either way it's cropped to the card's passport shape automatically."}
          </p>
        </div>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

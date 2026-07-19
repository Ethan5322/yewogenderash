"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, RefreshCw, Check, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/onboarding/file-dropzone";
import { captureBiometricAction } from "@/app/(public)/start/(wizard)/actions";

export function SelfieCapture() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const [mode, setMode] = React.useState<"idle" | "camera" | "upload">("idle");
  const [captured, setCaptured] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stopCamera = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  React.useEffect(() => () => stopCamera(), [stopCamera]);

  React.useEffect(() => {
    if (captured) {
      const url = URL.createObjectURL(captured);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [captured]);

  async function startCamera() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false,
      });
      streamRef.current = stream;
      setMode("camera");
      // Attach after render so the video element exists.
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Couldn't access the camera. You can upload a selfie photo instead.");
      setMode("upload");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        setCaptured(new File([blob], "selfie.jpg", { type: "image/jpeg" }));
        stopCamera();
        setMode("idle");
      },
      "image/jpeg",
      0.9
    );
  }

  async function submit() {
    if (!captured) return;
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("selfie", captured);
      const res = await captureBiometricAction(null, fd);
      if (res.ok) router.refresh();
      else setError(res.error);
    } catch {
      setError("Something went wrong uploading your selfie. Try again.");
    } finally {
      setBusy(false);
    }
  }

  // Captured → confirm & submit
  if (captured && previewUrl) {
    return (
      <div className="space-y-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local capture preview */}
        <img
          src={previewUrl}
          alt="Your selfie"
          className="mx-auto aspect-square w-56 rounded-lg object-cover"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={() => setCaptured(null)} disabled={busy}>
            <RefreshCw className="h-4 w-4" aria-hidden /> Retake
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Use this photo
          </Button>
        </div>
      </div>
    );
  }

  // Camera live
  if (mode === "camera") {
    return (
      <div className="space-y-3">
        <video
          ref={videoRef}
          playsInline
          muted
          className="mx-auto aspect-square w-56 rounded-lg bg-muted object-cover"
        />
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              stopCamera();
              setMode("idle");
            }}
          >
            Cancel
          </Button>
          <Button onClick={capture}>
            <Camera className="h-4 w-4" aria-hidden /> Capture
          </Button>
        </div>
      </div>
    );
  }

  // Upload fallback
  if (mode === "upload") {
    return (
      <div className="space-y-3">
        <FileDropzone
          name="selfie-upload"
          label="Upload a clear selfie"
          accept="image/jpeg,image/png,image/webp"
          file={captured}
          onFileChange={setCaptured}
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button variant="link" size="sm" onClick={() => setMode("idle")}>
          Use camera instead
        </Button>
      </div>
    );
  }

  // Idle
  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={startCamera}>
          <Camera className="h-4 w-4" aria-hidden /> Take a live selfie
        </Button>
        <Button variant="outline" onClick={() => setMode("upload")}>
          <Upload className="h-4 w-4" aria-hidden /> Upload instead
        </Button>
      </div>
    </div>
  );
}

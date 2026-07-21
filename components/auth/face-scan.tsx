"use client";

import * as React from "react";
import { Camera, Loader2, ScanFace, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeFace } from "@/lib/face/faceapi";

/**
 * Capture a live face and hand its 128-D descriptor back to the parent form.
 * Used as the biometric factor on the fundraiser sign-in.
 */
export function FaceScan({
  onDescriptor,
}: {
  onDescriptor: (descriptor: number[] | null) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [mode, setMode] = React.useState<"idle" | "camera" | "done">("idle");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  React.useEffect(() => () => stop(), [stop]);

  async function start() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setMode("camera");
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      });
    } catch {
      setError("Couldn't access the camera.");
    }
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setBusy(true);
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);
      const descriptor = await describeFace(canvas);
      if (!descriptor) {
        setError("No clear face detected — try again facing the camera in good light.");
        setBusy(false);
        return;
      }
      onDescriptor(descriptor);
      stop();
      setMode("done");
    } catch {
      setError("Face scan failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (mode === "done") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden /> Face verified
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onDescriptor(null);
            setMode("idle");
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Redo
        </Button>
      </div>
    );
  }

  if (mode === "camera") {
    return (
      <div className="space-y-2">
        <video ref={videoRef} playsInline muted className="mx-auto aspect-square w-40 rounded-lg bg-muted object-cover" />
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => { stop(); setMode("idle"); }}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={capture} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" aria-hidden />}
            Capture
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={start} className="w-full">
        <ScanFace className="h-4 w-4" aria-hidden /> Scan my face
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

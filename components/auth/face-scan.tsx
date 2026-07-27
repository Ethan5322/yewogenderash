"use client";

import * as React from "react";
import { Camera, Loader2, ScanFace, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeFace, detectLiveness } from "@/lib/face/faceapi";
import { assessImageQuality } from "@/lib/face/quality";
import { cameraErrorMessage } from "@/lib/image-crop";
import { createLivenessChallenge, type LivenessProgress } from "@/lib/face/liveness";
import { LivenessGuide, LivenessSubject } from "@/components/face/liveness-guide";

/**
 * Capture a live face and hand its 128-D descriptor back to the parent form.
 *
 * Two modes:
 *  - sign-in (default): a single frame is described and matched server-side
 *    against the enrolled template.
 *  - `requireLiveness` (enrolment): the subject is guided through the four-step
 *    challenge (look ahead, turn left, turn right, blink) before the frame is
 *    taken, so a held-up photo can never be enrolled.
 */
export function FaceScan({
  onDescriptor,
  requireLiveness = false,
  label,
  personName,
  personCode,
}: {
  onDescriptor: (descriptor: number[] | null) => void;
  requireLiveness?: boolean;
  label?: string;
  /** Who is being captured/verified — named on screen during the scan. */
  personName?: string;
  personCode?: string | null;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const loopRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // The challenge lives in a ref — the setInterval sampler would read stale
  // values off React state.
  const challenge = React.useRef(createLivenessChallenge());

  const [mode, setMode] = React.useState<"idle" | "camera" | "done">("idle");
  const [busy, setBusy] = React.useState(false);
  const [progress, setProgress] = React.useState<LivenessProgress>(() =>
    challenge.current.progress()
  );
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);
  React.useEffect(() => () => stop(), [stop]);

  function resetLiveness() {
    challenge.current.reset();
    setProgress(challenge.current.progress());
  }

  async function start() {
    setError(null);
    resetLiveness();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
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
      if (requireLiveness) loopRef.current = setInterval(sample, 150);
    } catch (err) {
      setError(cameraErrorMessage(err));
    }
  }

  /** Describe the current frame and hand the descriptor up. */
  async function grab(checkQuality: boolean): Promise<boolean> {
    const video = videoRef.current;
    if (!video) return false;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    if (checkQuality) {
      const quality = assessImageQuality(canvas);
      if (!quality.ok) {
        setError(quality.reason);
        return false;
      }
    }
    const descriptor = await describeFace(canvas);
    if (!descriptor) {
      setError("No clear face detected — try again facing the camera in good light.");
      return false;
    }
    onDescriptor(descriptor);
    stop();
    setMode("done");
    return true;
  }

  /** Liveness sampler (enrolment only): guided steps, then capture. */
  async function sample() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const s = await detectLiveness(video).catch(() => null);
    const next = challenge.current.feed(s);
    setProgress(next);
    if (!next.complete) return;

    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
    const ok = await grab(true);
    if (!ok) {
      // Quality/descriptor failed — run the challenge again.
      resetLiveness();
      loopRef.current = setInterval(sample, 150);
    }
  }

  async function captureNow() {
    setBusy(true);
    setError(null);
    await grab(false);
    setBusy(false);
  }

  if (mode === "done") {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-sm">
        <span className="flex items-center gap-2 text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
          {requireLiveness ? "Face captured (live check passed)" : "Face verified"}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            onDescriptor(null);
            resetLiveness();
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
        <LivenessSubject
          name={personName}
          code={personCode}
          purpose={requireLiveness ? "Live identity check" : "Signing in as"}
        />
        <video
          ref={videoRef}
          playsInline
          muted
          className="mx-auto aspect-square w-40 rounded-lg bg-muted object-cover"
        />
        {requireLiveness ? <LivenessGuide progress={progress} /> : null}
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
          {!requireLiveness ? (
            <Button type="button" size="sm" onClick={captureNow} disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Camera className="h-4 w-4" aria-hidden />
              )}
              Capture
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" size="sm" onClick={start} className="w-full">
        <ScanFace className="h-4 w-4" aria-hidden />
        {label ?? (requireLiveness ? "Start live face capture" : "Scan my face")}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

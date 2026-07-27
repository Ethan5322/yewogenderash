"use client";

import * as React from "react";
import { Camera, Loader2, CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeFace, detectLiveness } from "@/lib/face/faceapi";
import { assessImageQuality } from "@/lib/face/quality";
import { cropToIdPortrait } from "@/lib/image-crop";
import { createLivenessChallenge, type LivenessProgress } from "@/lib/face/liveness";
import { LivenessGuide, LivenessSubject } from "@/components/face/liveness-guide";
import { realtimeClient, captureChannelName } from "@/lib/supabase/realtime";

/**
 * Runs on the fundraiser's PHONE (opened via the QR link). Opens the camera,
 * captures the selfie, extracts a face descriptor, uploads it authorised by the
 * token, then broadcasts "done" over Supabase Realtime so their computer
 * advances automatically.
 */
export function MobileCapture({
  token,
  name,
  code,
}: {
  token: string;
  name: string;
  code?: string | null;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const loopRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  const challenge = React.useRef(createLivenessChallenge());
  const [phase, setPhase] = React.useState<"loading" | "camera" | "uploading" | "done" | "error">("loading");
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

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        setPhase("camera");
        requestAnimationFrame(() => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            void videoRef.current.play();
          }
        });
        // Same guided challenge as on a computer — the phone path is no longer
        // a way to skip the live check.
        loopRef.current = setInterval(sample, 150);
      } catch {
        setError("Couldn't open the camera. Allow camera access and reload this page.");
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [stop]);

  async function sample() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const s = await detectLiveness(video).catch(() => null);
    const next = challenge.current.feed(s);
    setProgress(next);
    if (next.complete) {
      if (loopRef.current) clearInterval(loopRef.current);
      loopRef.current = null;
      void capture();
    }
  }

  function retryChallenge() {
    challenge.current.reset();
    setProgress(challenge.current.progress());
    setPhase("camera");
    if (!loopRef.current) loopRef.current = setInterval(sample, 150);
  }

  async function capture() {
    const video = videoRef.current;
    if (!video) return;
    setPhase("uploading");
    setError(null);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext("2d")?.drawImage(video, 0, 0);

      const quality = assessImageQuality(canvas);
      if (!quality.ok) {
        setError(quality.reason);
        retryChallenge();
        return;
      }
      const descriptor = await describeFace(canvas);
      if (!descriptor) {
        setError("No clear face detected. Face the camera in good light and try again.");
        retryChallenge();
        return;
      }
      // Store the ID portrait framing, not the raw camera frame.
      const file = await cropToIdPortrait(canvas).catch(
        async () =>
          new File(
            [
              await new Promise<Blob>((res, rej) =>
                canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.9)
              ),
            ],
            "selfie.jpg",
            { type: "image/jpeg" }
          )
      );

      const fd = new FormData();
      fd.append("selfie", file);
      fd.append("descriptor", JSON.stringify(descriptor));
      fd.append("liveness", "passed");
      const res = await fetch(`/api/capture/${token}`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Upload failed. Try again.");
        retryChallenge();
        return;
      }

      // Tell the computer we're done (auto-advances there).
      try {
        const ch = realtimeClient().channel(captureChannelName(token));
        await ch.subscribe();
        await ch.send({ type: "broadcast", event: "done", payload: { ok: true } });
      } catch {
        /* the computer also has a manual refresh fallback */
      }
      stop();
      setPhase("done");
    } catch {
      setError("Something went wrong. Try again.");
      retryChallenge();
    }
  }

  if (phase === "done") {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center p-8 text-center">
        <CheckCircle2 className="h-14 w-14 text-success" aria-hidden />
        <h1 className="mt-4 text-xl font-semibold">Photo sent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your selfie was captured and sent. Return to your computer — your
          verification continues automatically.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="w-full">
        <LivenessSubject name={name} code={code} purpose="Live identity check" />
      </div>
      <video
        ref={videoRef}
        playsInline
        muted
        className="aspect-[3/4] w-64 rounded-2xl border bg-muted object-cover"
      />
      {phase === "camera" ? <LivenessGuide progress={progress} className="w-full" /> : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {phase === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening camera…
        </p>
      ) : phase === "error" ? (
        <Button onClick={() => location.reload()}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Retry
        </Button>
      ) : phase === "uploading" ? (
        <p className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Capturing and
          sending…
        </p>
      ) : (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Camera className="h-3.5 w-3.5" aria-hidden /> The photo is taken
          automatically once all four steps pass.
        </p>
      )}
      <p className="text-xs text-muted-foreground">Hold your phone at eye level, facing you.</p>
    </div>
  );
}

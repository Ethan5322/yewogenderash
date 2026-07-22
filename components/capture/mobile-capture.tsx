"use client";

import * as React from "react";
import { Camera, Loader2, CheckCircle2, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import { describeFace } from "@/lib/face/faceapi";
import { realtimeClient, captureChannelName } from "@/lib/supabase/realtime";

/**
 * Runs on the fundraiser's PHONE (opened via the QR link). Opens the camera,
 * captures the selfie, extracts a face descriptor, uploads it authorised by the
 * token, then broadcasts "done" over Supabase Realtime so their computer
 * advances automatically.
 */
export function MobileCapture({ token, name }: { token: string; name: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [phase, setPhase] = React.useState<"loading" | "camera" | "uploading" | "done" | "error">("loading");
  const [error, setError] = React.useState<string | null>(null);

  const stop = React.useCallback(() => {
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

      const descriptor = await describeFace(canvas);
      if (!descriptor) {
        setError("No clear face detected. Face the camera in good light and try again.");
        setPhase("camera");
        return;
      }
      const blob: Blob = await new Promise((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode failed"))), "image/jpeg", 0.9)
      );

      const fd = new FormData();
      fd.append("selfie", new File([blob], "selfie.jpg", { type: "image/jpeg" }));
      fd.append("descriptor", JSON.stringify(descriptor));
      const res = await fetch(`/api/capture/${token}`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Upload failed. Try again.");
        setPhase("camera");
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
      setPhase("camera");
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
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <ScanFace className="h-4 w-4" aria-hidden /> Face capture for {name}
      </div>
      <video
        ref={videoRef}
        playsInline
        muted
        className="aspect-[3/4] w-64 rounded-2xl border bg-muted object-cover"
      />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {phase === "loading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening camera…
        </p>
      ) : phase === "error" ? (
        <Button onClick={() => location.reload()}>
          <RefreshCw className="h-4 w-4" aria-hidden /> Retry
        </Button>
      ) : (
        <Button size="lg" onClick={capture} disabled={phase === "uploading"}>
          {phase === "uploading" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" aria-hidden />}
          {phase === "uploading" ? "Sending…" : "Capture selfie"}
        </Button>
      )}
      <p className="text-xs text-muted-foreground">Hold your phone at eye level, facing you.</p>
    </div>
  );
}

"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2, Upload, ScanFace, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FileDropzone } from "@/components/onboarding/file-dropzone";
import { captureBiometricAction } from "@/app/(public)/start/(wizard)/actions";
import { describeFace, detectLiveness } from "@/lib/face/faceapi";
import { assessImageQuality } from "@/lib/face/quality";

// Liveness thresholds.
const TURN_RANGE = 0.28; // left+right head-turn spread (normalised nose offset)
const BLINK_CLOSED = 0.2; // eye-aspect ratio when the eye is shut
const BLINK_OPEN = 0.28; // ...and re-opened

function fileToImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("image load failed"));
    };
    img.src = url;
  });
}

export function SelfieCapture() {
  const router = useRouter();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const loopRef = React.useRef<ReturnType<typeof setInterval> | null>(null);
  // Liveness accumulators live in a ref so the setInterval sampler never reads
  // stale React state.
  const live = React.useRef({ minX: 1, maxX: -1, armed: false, turnOk: false, blinkOk: false });

  const [mode, setMode] = React.useState<"idle" | "camera" | "captured" | "upload">("idle");
  const [turnOk, setTurnOk] = React.useState(false);
  const [blinkOk, setBlinkOk] = React.useState(false);
  const [prompt, setPrompt] = React.useState("Position your face in the frame");
  const [captured, setCaptured] = React.useState<File | null>(null);
  const [descriptor, setDescriptor] = React.useState<number[] | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const stopCamera = React.useCallback(() => {
    if (loopRef.current) clearInterval(loopRef.current);
    loopRef.current = null;
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

  function resetLiveness() {
    live.current = { minX: 1, maxX: -1, armed: false, turnOk: false, blinkOk: false };
    setTurnOk(false);
    setBlinkOk(false);
  }

  async function grabFrame(): Promise<File | null> {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    const quality = assessImageQuality(canvas);
    if (!quality.ok) {
      setError(quality.reason);
      return null;
    }
    const desc = await describeFace(canvas);
    if (!desc) {
      setError("Face not clear at capture — hold still, facing the camera.");
      return null;
    }
    setDescriptor(desc);
    return await new Promise<File | null>((resolve) =>
      canvas.toBlob(
        (b) => resolve(b ? new File([b], "selfie.jpg", { type: "image/jpeg" }) : null),
        "image/jpeg",
        0.92
      )
    );
  }

  async function startCamera() {
    setError(null);
    resetLiveness();
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
      loopRef.current = setInterval(sample, 150);
    } catch {
      setError("Couldn't access the camera. You can upload a selfie instead.");
      setMode("upload");
    }
  }

  async function sample() {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return;
    const s = await detectLiveness(video).catch(() => null);
    if (!s) {
      setPrompt("Position your face in the frame");
      return;
    }
    // Head-turn spread.
    live.current.minX = Math.min(live.current.minX, s.faceX);
    live.current.maxX = Math.max(live.current.maxX, s.faceX);
    const spread = live.current.maxX - live.current.minX;
    if (spread >= TURN_RANGE && !live.current.turnOk) {
      live.current.turnOk = true;
      setTurnOk(true);
    }
    // Blink: eye closes then re-opens.
    if (s.ear < BLINK_CLOSED) live.current.armed = true;
    if (live.current.armed && s.ear > BLINK_OPEN && !live.current.blinkOk) {
      live.current.blinkOk = true;
      live.current.armed = false;
      setBlinkOk(true);
    }

    if (!live.current.turnOk) setPrompt("Slowly turn your head left, then right");
    else if (!live.current.blinkOk) setPrompt("Great — now blink");
    else {
      setPrompt("Hold still…");
      if (loopRef.current) clearInterval(loopRef.current);
      loopRef.current = null;
      const file = await grabFrame();
      if (file) {
        stopCamera();
        setCaptured(file);
        setMode("captured");
      } else {
        // Quality/descriptor failed — let them retry the challenge.
        resetLiveness();
        loopRef.current = setInterval(sample, 150);
      }
    }
  }

  async function submit(fromUpload: boolean) {
    if (!captured) return;
    setBusy(true);
    setError(null);
    try {
      // Upload fallback has no liveness — compute the descriptor from the file.
      let desc = descriptor;
      if (!desc) {
        try {
          const img = await fileToImage(captured);
          const q = assessImageQuality(img);
          if (!q.ok) {
            setError(q.reason);
            setBusy(false);
            return;
          }
          desc = await describeFace(img);
        } catch {
          desc = null;
        }
      }
      if (!desc) {
        setError("We couldn't detect a clear face. Retake in good lighting.");
        setBusy(false);
        return;
      }
      const fd = new FormData();
      fd.append("selfie", captured);
      fd.append("descriptor", JSON.stringify(desc));
      fd.append("liveness", fromUpload ? "" : "passed");
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
  if (mode === "captured" && captured && previewUrl) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-center gap-1.5 text-sm text-success">
          <Check className="h-4 w-4" aria-hidden /> Liveness confirmed
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- local capture preview */}
        <img src={previewUrl} alt="Your selfie" className="mx-auto aspect-square w-56 rounded-lg object-cover" />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setCaptured(null);
              setDescriptor(null);
              setMode("idle");
            }}
            disabled={busy}
          >
            <RefreshCw className="h-4 w-4" aria-hidden /> Retake
          </Button>
          <Button onClick={() => submit(false)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
            Use this photo
          </Button>
        </div>
      </div>
    );
  }

  // Camera live — liveness challenge
  if (mode === "camera") {
    return (
      <div className="space-y-3">
        <video ref={videoRef} playsInline muted className="mx-auto aspect-square w-56 rounded-full border-4 border-primary/30 bg-muted object-cover" />
        <p className="text-center text-sm font-medium">{prompt}</p>
        <div className="flex justify-center gap-4 text-xs">
          <span className={turnOk ? "text-success" : "text-muted-foreground"}>
            {turnOk ? "✓" : "○"} Head turn
          </span>
          <span className={blinkOk ? "text-success" : "text-muted-foreground"}>
            {blinkOk ? "✓" : "○"} Blink
          </span>
        </div>
        {error ? <p className="text-center text-xs text-destructive">{error}</p> : null}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => { stopCamera(); setMode("idle"); }}>
            Cancel
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
          onFileChange={(f) => {
            setCaptured(f);
            setDescriptor(null);
          }}
        />
        {captured ? (
          <Button onClick={() => submit(true)} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
            Use this photo
          </Button>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <Button variant="link" size="sm" onClick={() => { setError(null); setMode("idle"); }}>
          Use camera instead
        </Button>
      </div>
    );
  }

  // Idle
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        A live check confirms a real person: you&apos;ll turn your head and blink.
      </p>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={startCamera}>
          <ScanFace className="h-4 w-4" aria-hidden /> Start live check
        </Button>
        <Button variant="outline" onClick={() => setMode("upload")}>
          <Upload className="h-4 w-4" aria-hidden /> Upload instead
        </Button>
      </div>
    </div>
  );
}

// In-browser face recognition (client only), adapted from the Yoyo GYM engine.
//
// Uses @vladmandic/face-api (TensorFlow.js) with models served from a free CDN —
// no paid API, everything runs in the browser. We use it to:
//   • detect that a REAL face is present in the live capture (anti-spoof gate),
//   • extract a 128-D descriptor (the biometric template), and
//   • match two faces by Euclidean distance (same-person check vs. the ID photo,
//     and vs. the enrolled template at login).

/* eslint-disable @typescript-eslint/no-explicit-any */
export { MATCH_THRESHOLD, faceDistance, isSamePerson } from "@/lib/face/distance";

let _faceapi: Promise<any> | null = null;
const _nets: Record<string, Promise<any>> = {};

const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.15/model";
const TFJS_VERSION = "4.22.0";
const WASM_PATH = `https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@${TFJS_VERSION}/dist/`;
const BACKENDS = ["webgl", "wasm", "cpu"];

export let activeBackend: string | null = null;

function lib(): Promise<any> {
  if (!_faceapi) {
    _faceapi = import("@vladmandic/face-api").then(async (f: any) => {
      try {
        f.tf.setWasmPaths(WASM_PATH);
      } catch {
        /* older build */
      }
      for (const b of BACKENDS) {
        try {
          if (await f.tf.setBackend(b)) break;
        } catch {
          /* next backend */
        }
      }
      await f.tf.ready();
      activeBackend = f.tf.getBackend();
      return f;
    });
  }
  return _faceapi;
}

const NETS: Record<string, (f: any) => any> = {
  tiny: (f) => f.nets.tinyFaceDetector,
  landmarks: (f) => f.nets.faceLandmark68Net,
  ssd: (f) => f.nets.ssdMobilenetv1,
  recognition: (f) => f.nets.faceRecognitionNet,
};

async function loadNets(...names: string[]): Promise<any> {
  const f = await lib();
  await Promise.all(
    names.map((n) => {
      if (!_nets[n]) {
        _nets[n] = NETS[n](f)
          .loadFromUri(MODEL_URL)
          .catch((e: unknown) => {
            delete _nets[n];
            throw e;
          });
      }
      return _nets[n];
    })
  );
  return f;
}

/** Nets for live positioning guidance only (fast, box-only). */
export function loadForGuide() {
  return loadNets("tiny");
}

/** Everything needed to produce/compare 128-D descriptors. */
export function loadForRecognition() {
  return loadNets("tiny", "ssd", "landmarks", "recognition");
}

export type FaceBox = { x: number; y: number; width: number; height: number; score: number };

/** Fast bounding-box detection for the live positioning guide. */
export async function detectBox(el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement): Promise<FaceBox | null> {
  const f = await loadForGuide();
  const det = await f.detectSingleFace(el, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }));
  if (!det) return null;
  return { x: det.box.x, y: det.box.y, width: det.box.width, height: det.box.height, score: det.score };
}

/** Nets for the liveness challenge: tiny detector + landmarks (no descriptor). */
export function loadForLiveness() {
  return loadNets("tiny", "landmarks");
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Eye aspect ratio for a 6-point eye — drops sharply during a blink. */
function eyeAspect(eye: { x: number; y: number }[]): number {
  if (!eye || eye.length < 6) return 1;
  const v = dist(eye[1], eye[5]) + dist(eye[2], eye[4]);
  const h = 2 * dist(eye[0], eye[3]);
  return h === 0 ? 1 : v / h;
}

export type LivenessSample = {
  /** Nose offset from face-box centre, normalised by box width (~-0.5..0.5). */
  faceX: number;
  /** Average eye aspect ratio (blink when it dips below ~0.2). */
  ear: number;
  box: FaceBox;
};

/**
 * One liveness sample from a live frame: head-turn offset + blink metric. The
 * caller collects these over a few seconds to prove a live, moving 3-D face
 * (a held-up photo can't satisfy both a left+right turn and a blink).
 */
export async function detectLiveness(
  el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<LivenessSample | null> {
  const f = await loadForLiveness();
  const det = await f
    .detectSingleFace(el, new f.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
    .withFaceLandmarks();
  if (!det) return null;
  const box = det.detection.box;
  const lm = det.landmarks;
  const nose = lm.getNose();
  const tip = nose[6] ?? nose[nose.length - 1];
  const cx = box.x + box.width / 2;
  const faceX = box.width ? (tip.x - cx) / box.width : 0;
  const ear = (eyeAspect(lm.getLeftEye()) + eyeAspect(lm.getRightEye())) / 2;
  return {
    faceX,
    ear,
    box: { x: box.x, y: box.y, width: box.width, height: box.height, score: det.detection.score },
  };
}

/**
 * Detect the single most prominent face and return its 128-D descriptor.
 * Returns null when no face is found (spoof/blank frame/bad photo).
 */
export async function describeFace(
  el: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement
): Promise<number[] | null> {
  const f = await loadForRecognition();
  // High-accuracy SSD detector for a stable enrolment/probe descriptor.
  let det = await f
    .detectSingleFace(el, new f.SsdMobilenetv1Options({ minConfidence: 0.3 }))
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!det) {
    // Fall back to the tiny detector for harsh light / steep angles.
    det = await f
      .detectSingleFace(el, new f.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.3 }))
      .withFaceLandmarks()
      .withFaceDescriptor();
  }
  return det ? Array.from(det.descriptor as Float32Array).map(Number) : null;
}


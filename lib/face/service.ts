import "server-only";

/**
 * Optional high-accuracy face matching via the InsightFace microservice
 * (face-service/ — RetinaFace + ArcFace, cosine similarity). Used as the
 * AUTHORITATIVE KYC same-person check when `FACE_SERVICE_URL` is set; otherwise
 * the app falls back to the in-browser face-api engine.
 *
 * Configure:
 *   FACE_SERVICE_URL = https://<user>-<space>.hf.space   (no trailing slash)
 *   FACE_API_KEY     = <shared secret>   (optional; must match the service)
 *
 * The service is 1:1 stateless via /compare, so a Yoyo/other deployment can be
 * reused without any member store collision.
 */

export function faceServiceConfigured(): boolean {
  return !!process.env.FACE_SERVICE_URL;
}

function base(): string {
  return (process.env.FACE_SERVICE_URL ?? "").replace(/\/$/, "");
}

/** Fetch an http(s) image URL and return it as a base64 data-URL. */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") || "image/jpeg";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export type FaceCompareResult = { similarity: number; samePerson: boolean };

/**
 * Cosine-similarity 1:1 compare of the faces in two images. Each image may be a
 * data-URL / raw base64, or an http(s) URL (fetched here first). Returns null
 * when the service is unconfigured, unreachable, or found no face.
 */
export async function faceCompare(
  imageA: string,
  imageB: string
): Promise<FaceCompareResult | null> {
  if (!faceServiceConfigured()) return null;

  const a = /^https?:\/\//.test(imageA) ? await imageUrlToDataUrl(imageA) : imageA;
  const b = /^https?:\/\//.test(imageB) ? await imageUrlToDataUrl(imageB) : imageB;
  if (!a || !b) return null;

  try {
    const res = await fetch(`${base()}/compare`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        image_a: a,
        image_b: b,
        api_key: process.env.FACE_API_KEY || undefined,
      }),
      cache: "no-store",
      // The first request can be slow (cold Space + model load).
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json().catch(() => null)) as
      | { ok?: boolean; similarity?: number; same_person?: boolean }
      | null;
    if (!res.ok || !body?.ok || typeof body.similarity !== "number") return null;
    return { similarity: body.similarity, samePerson: !!body.same_person };
  } catch {
    return null;
  }
}

/** Liveness/availability probe for the service (used by admin diagnostics). */
export async function faceServiceHealth(): Promise<{ ok: boolean; threshold?: number } | null> {
  if (!faceServiceConfigured()) return null;
  try {
    const res = await fetch(`${base()}/health`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; threshold?: number } | null;
    if (!res.ok || !body?.ok) return { ok: false };
    return { ok: true, threshold: body.threshold };
  } catch {
    return { ok: false };
  }
}

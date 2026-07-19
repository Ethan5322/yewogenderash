import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requiredEnv } from "@/lib/env";

/**
 * Server-only Supabase client using the SERVICE ROLE key — full storage access.
 * NEVER import this into a client component or expose the key to the browser.
 * KYC documents live in a PRIVATE bucket and are only ever reached through
 * short-lived signed URLs generated here for authorised admins.
 */
let cached: SupabaseClient | null = null;

export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  cached = createClient(
    requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  return cached;
}

// Shared free-tier project ⇒ buckets carry the yd- prefix, never touch others.
export const KYC_BUCKET = "yd-kyc"; // private — identity documents & selfies
export const MEDIA_BUCKET = "yd-media"; // public — campaign hero images

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_DOC_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

/**
 * Upload a KYC file to the private bucket. `path` should be scoped by owner,
 * e.g. `owners/<ownerId>/national-id-<ts>.jpg`. Returns the stored path (never
 * a public URL — the bucket is private).
 */
export async function uploadKycFile(
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin()
    .storage.from(KYC_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, path };
}

/** Short-lived signed URL for an admin to view a private KYC document. */
export async function signedKycUrl(
  path: string,
  expiresInSeconds = 300
): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .storage.from(KYC_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error || !data) return null;
  return data.signedUrl;
}

/** Remove a KYC object (e.g. superseded on resubmit). Best-effort. */
export async function removeKycFile(path: string): Promise<void> {
  await supabaseAdmin().storage.from(KYC_BUCKET).remove([path]);
}

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

/**
 * Upload campaign media (hero images) to the PUBLIC bucket and return the
 * public URL. Images only — documents never go through this path.
 */
export async function uploadMediaFile(
  path: string,
  body: ArrayBuffer | Uint8Array,
  contentType: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { error } = await supabaseAdmin()
    .storage.from(MEDIA_BUCKET)
    .upload(path, body, { contentType, upsert: true });
  if (error) return { ok: false, error: error.message };
  const { data } = supabaseAdmin().storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return { ok: true, url: data.publicUrl };
}

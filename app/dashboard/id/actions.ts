"use server";

export type ActionResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * DISABLED (anti-fraud). The ID portrait is fixed to the verified identity — the
 * face that passed KYC — and can no longer be changed by the owner. Kept as a
 * stub so any stale caller gets a clear, safe refusal.
 */
export async function uploadIdPhotoAction(): Promise<ActionResult> {
  return {
    ok: false,
    error: "Changing your ID photo is disabled to protect donors from identity fraud.",
  };
}

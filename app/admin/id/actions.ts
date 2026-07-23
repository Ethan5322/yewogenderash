"use server";

export type ActionResult = { ok: true; url: string } | { ok: false; error: string };

/**
 * DISABLED (anti-fraud). Staff biometric/photo is fixed at enrolment and cannot
 * be changed here. Kept as a stub so any stale caller gets a clear refusal.
 */
export async function uploadAdminPhotoAction(): Promise<ActionResult> {
  return {
    ok: false,
    error: "Changing your staff photo is disabled. Contact a main admin if a correction is required.",
  };
}

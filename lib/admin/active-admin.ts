import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";

/**
 * "Is this user, right now, an active admin?" — a boolean, read from the DATABASE.
 *
 * WHY THIS EXISTS SEPARATELY FROM permissions.ts
 *   currentAdmin() redirects, which makes it unusable on a PUBLIC page that only
 *   wants to show an admin something extra. Those pages were reading
 *   `session.user.role` from the JWT instead — and a JWT is a snapshot up to 7
 *   days old (auth.config.ts maxAge), so a demoted, suspended or offboarded admin
 *   kept a token that still said ADMIN. On /a/[authorCode] that token bought a
 *   signed URL to a fundraiser's biometric selfie, from a page with no admin
 *   guard in front of it.
 *
 *   It lives in its own module rather than in lib/admin/permissions.ts for two
 *   reasons: that file imports `auth`, which drags next-auth and next/server into
 *   anything that imports it (the integration test could not load at all), and
 *   permissions.ts holds the capability model, which is a file to touch as rarely
 *   as possible.
 *
 * The user id is passed in rather than read from the session, so this can be
 * tested against a real database without faking a session.
 *
 * `isBanned` is checked deliberately. Sign-in already refuses banned users
 * (auth.ts), but that only governs NEW sessions — a session issued before the ban
 * is untouched by it, and this is the last gate in front of biometric data.
 *
 * React-`cache`d, so several checks in one render share one query; the cache is
 * per-request, so a revocation takes effect on the very next request.
 */
export const isActiveAdmin = cache(async function isActiveAdmin(
  userId: string | null | undefined
): Promise<boolean> {
  if (!userId) return false;
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, isBanned: true },
  });
  return user?.role === "ADMIN" && !user.isBanned;
});

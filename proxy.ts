import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Route protection (Next 16 `proxy` convention — replaces the deprecated
 * `middleware` file). Uses the edge-safe config: the session cookie is a
 * SIGNED JWT verified with AUTH_SECRET — a hand-written cookie fails
 * verification. Authorization rules live in authConfig.callbacks.authorized.
 * Server components re-check roles (defense in depth); this is the outer gate,
 * never the only one.
 */
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/admin/:path*", "/dashboard/:path*", "/login", "/register"],
};

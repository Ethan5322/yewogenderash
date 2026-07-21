import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe Auth.js config — used by middleware for JWT verification and
 * route authorization. MUST NOT import Prisma, bcrypt, or any Node-only
 * module. The full config (with the Credentials provider) lives in auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    // 7 days — short enough for a money platform, long enough not to nag.
    maxAge: 7 * 24 * 60 * 60,
  },
  callbacks: {
    jwt({ token, user }) {
      // On sign-in, copy id + role into the token (signed with AUTH_SECRET).
      if (user) {
        token.uid = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.role = token.role as "DONOR" | "OWNER" | "ADMIN";
      }
      return session;
    },
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const user = auth?.user;
      const isLoggedIn = !!user;

      // Admin control room: ADMIN only. Logged-out users go to the dedicated
      // /admin-login (2FA), never the public /login. (/admin-login itself is
      // not under /admin/ so it's excluded here.)
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        if (!isLoggedIn) {
          return Response.redirect(new URL("/admin-login", request.nextUrl));
        }
        if (user.role !== "ADMIN") {
          return Response.redirect(new URL("/", request.nextUrl));
        }
        return true;
      }

      // Owner/donor dashboard: any authenticated user; page-level guards
      // scope the data.
      if (pathname.startsWith("/dashboard")) {
        return isLoggedIn;
      }

      // Signed-in users don't need the auth pages.
      if ((pathname === "/login" || pathname === "/register") && isLoggedIn) {
        return Response.redirect(new URL("/", request.nextUrl));
      }

      return true;
    },
  },
  providers: [], // filled in by auth.ts (Node runtime only)
} satisfies NextAuthConfig;

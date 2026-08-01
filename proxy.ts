import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { rateLimit, ipKey, tooManyResponse } from "@/lib/rate-limit";

/**
 * Route protection (Next 16 `proxy` convention — replaces the deprecated
 * `middleware` file). Uses the edge-safe config: the session cookie is a
 * SIGNED JWT verified with AUTH_SECRET — a hand-written cookie fails
 * verification. Authorization rules live in authConfig.callbacks.authorized.
 * Server components re-check roles (defense in depth); this is the outer gate,
 * never the only one.
 *
 * It also stamps the Content-Security-Policy, because a per-request nonce can
 * only be minted here.
 *
 * IMPORTANT — why the authorization is invoked by hand below: passing a handler
 * to Auth.js's `auth()` stops it applying `authorized` for you, so a handler
 * that simply returned a response would silently disable the gate (an earlier
 * attempt at this did exactly that, and let /dashboard render logged out). The
 * handler therefore calls the SAME `authorized` callback and honours its answer
 * before doing anything else. The rules still live in auth.config.ts and are not
 * duplicated here.
 */

/**
 * CSP with a per-request nonce.
 *
 * REPORT-ONLY unless CSP_ENFORCE=1. A wrong CSP fails silently and ugly — a
 * chunk or a stylesheet simply never loads — so it reports against real traffic
 * before it is allowed to block anything. Whatever appears as a violation in the
 * browser console now WILL break once enforced.
 *
 * The awkward entries are all load-bearing:
 *
 *  - 'wasm-unsafe-eval' + cdn.jsdelivr.net — face recognition fetches the
 *    face-api models and the TensorFlow WASM backend from that CDN at runtime
 *    (lib/face/faceapi.ts). Without both, staff face sign-in and the KYC live
 *    capture stop working.
 *  - img-src https: — hero images and ID photos are user uploads that can live
 *    on any host, so the set cannot be enumerated.
 *  - style-src 'unsafe-inline' — Next and Tailwind emit inline styles that
 *    cannot carry a nonce. Inline style is a far smaller risk than inline
 *    script, which stays nonce-only.
 *  - blob: — the camera preview, the ID-card canvas exports and the WASM worker
 *    all use blob URLs.
 */
function buildCsp(nonce: string): string {
  const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseWs = supabase.replace(/^https:/, "wss:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "object-src": ["'none'"],
    "frame-ancestors": ["'none'"],
    "form-action": ["'self'"],
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      // Lets Next's bootstrap load its own chunks without listing every hash.
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
    ],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:", "https:"],
    "font-src": ["'self'", "data:"],
    "media-src": ["'self'", "blob:"],
    "worker-src": ["'self'", "blob:"],
    "connect-src": [
      "'self'",
      "blob:",
      supabase,
      supabaseWs,
      "https://cdn.jsdelivr.net",
    ].filter(Boolean),
    "frame-src": ["'self'"],
  };

  const csp = Object.entries(directives)
    .map(([k, v]) => `${k} ${v.join(" ")}`)
    .join("; ");

  // Only meaningful over HTTPS, and it would break local http dev.
  return process.env.NODE_ENV === "production"
    ? `${csp}; upgrade-insecure-requests`
    : csp;
}

const { auth } = NextAuth(authConfig);

export default auth(async (request) => {
  // ── 0. Cheap first line against sign-in flooding ─────────────────────────
  // Every other public write path in this app is rate-limited; the credential
  // callback was not. This is per-instance and therefore best-effort — an
  // attacker spreading requests across warm instances gets more than 10 — so it
  // is only the outer layer. The lock that actually holds is counted in the
  // database, on the account (lib/auth/lockout.ts).
  //
  // Placed before authorization because the credential callback is a public
  // route: `authorized` would let it straight through.
  if (
    request.method === "POST" &&
    request.nextUrl.pathname.startsWith("/api/auth/callback")
  ) {
    const flood = await rateLimit(ipKey(request, "signin"), 10, 15 * 60_000);
    if (!flood.ok) return tooManyResponse(flood);
  }

  // ── 1. Authorization, using the project's own rules ──────────────────────
  const decide = authConfig.callbacks.authorized;
  const verdict = await decide({
    auth: request.auth,
    request,
  });

  // A rule that wants to send them somewhere (e.g. /admin → /admin-login).
  if (verdict instanceof Response) return verdict;

  // Denied without a destination: Auth.js's own default is the configured
  // sign-in page, carrying where they were trying to reach.
  if (verdict === false) {
    const signIn = new URL(authConfig.pages.signIn, request.nextUrl);
    signIn.searchParams.set(
      "callbackUrl",
      request.nextUrl.pathname + request.nextUrl.search
    );
    return NextResponse.redirect(signIn);
  }

  // ── 2. Allowed — attach the CSP ──────────────────────────────────────────
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const csp = buildCsp(nonce);

  // Next reads the nonce off the REQUEST headers and stamps it onto the script
  // tags it emits — that is what makes 'strict-dynamic' work.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set(
    process.env.CSP_ENFORCE === "1"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only",
    csp
  );
  return response;
});

export const config = {
  /**
   * Widened from the four auth paths so the CSP reaches every page. The
   * authorization rules are unchanged and still applied above — `authorized`
   * returns true for anything outside /admin, /dashboard, /login and /register,
   * so public routes behave exactly as before and simply pick up the header.
   *
   * Excludes Next's build output, the image optimiser and any static file with
   * an extension: those execute no script and only add overhead.
   */
  matcher: ["/((?!_next/static|_next/image|.*\\.[\\w]+$).*)"],
};

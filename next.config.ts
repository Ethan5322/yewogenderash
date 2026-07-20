import type { NextConfig } from "next";

/**
 * Baseline security headers applied to every response. Conservative on purpose
 * — no Content-Security-Policy yet (it needs per-page nonces for Next's inline
 * scripts; tracked for a later pass). These are the safe, high-value defaults.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    // Camera stays enabled: the KYC selfie step uses getUserMedia.
    value: "geolocation=(), microphone=(), payment=(), camera=(self)",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

// Turbopack workspace root:
// - Local Windows dev: node_modules is a junction escaping the project, so the
//   root must be the common ancestor (C:\Users\mule).
// - Everywhere else (incl. Vercel/Linux): pin explicitly to the project dir.
//   Leaving it unset let Turbopack mis-detect a root outside the project on
//   Vercel ("Invalid distDirRoot: .next … navigate out of the projectPath").
const turbopackRoot =
  process.platform === "win32" && !process.env.VERCEL
    ? "C:\\Users\\mule"
    : process.cwd();

const nextConfig: NextConfig = {
  turbopack: { root: turbopackRoot },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

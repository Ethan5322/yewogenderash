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

// Turbopack workspace root. Defaults to the project dir (correct on Vercel, so
// `.next` is inside the root — no "Invalid distDirRoot"). Local Windows dev,
// where node_modules is a junction escaping the project, sets TURBOPACK_ROOT in
// its own gitignored .env to the common ancestor. No absolute path is ever
// committed, so it can never leak into the Linux build.
const nextConfig: NextConfig = {
  turbopack: { root: process.env.TURBOPACK_ROOT || process.cwd() },
  experimental: {
    // Server Actions cap request bodies at 1 MB by default. Campaign creation
    // posts a proof document AND a hero photo through one action, each allowed
    // up to 5 MB (MAX_UPLOAD_BYTES), so the default rejected real phone photos
    // with a body-size error and the upload appeared to "fail". Lift it to fit
    // both files plus form fields.
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

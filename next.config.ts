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

const nextConfig: NextConfig = {
  // node_modules is a junction to C:\Users\mule\AppData\Local\yewogen-stage
  // (outside OneDrive — see docs/dev notes). Turbopack refuses symlinks that
  // escape its filesystem root, so widen the root to the common ancestor.
  turbopack: {
    root: "C:\\Users\\mule",
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

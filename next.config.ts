import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node_modules is a junction to C:\Users\mule\AppData\Local\yewogen-stage
  // (outside OneDrive — see docs/dev notes). Turbopack refuses symlinks that
  // escape its filesystem root, so widen the root to the common ancestor.
  turbopack: {
    root: "C:\\Users\\mule",
  },
};

export default nextConfig;

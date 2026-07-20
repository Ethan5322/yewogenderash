import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // A dummy URL so modules that construct the Prisma client at import time
    // load. The pg adapter connects lazily, so pure-logic tests never hit a DB.
    env: {
      DATABASE_URL:
        "postgresql://user:pass@localhost:5432/test?schema=public",
    },
  },
  resolve: {
    alias: {
      // Mirror the "@/..." path alias from tsconfig for imports in tests.
      "@": fileURLToPath(new URL("./", import.meta.url)),
      // `server-only` throws outside Next's RSC bundler — stub it to a no-op.
      "server-only": fileURLToPath(
        new URL("./tests/stubs/server-only.ts", import.meta.url)
      ),
    },
  },
});

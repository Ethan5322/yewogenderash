import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
    // A dummy URL so modules that construct the Prisma client at import time
    // load. The pg adapter connects lazily, so pure-logic tests never hit a DB.
    //
    // A REAL DATABASE_URL wins, which is what lets the integration tests run
    // against a throwaway database from scripts/local-db.mjs. Without this
    // fallback the dummy would overwrite it and lib/db's singleton would point
    // at nothing. Those tests refuse to run against a non-local host, so a
    // production URL here cannot cause writes.
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://user:pass@localhost:5432/test?schema=public",
    },
    server: {
      deps: {
        // next-auth does `import "next/server"`, a bare specifier Node's ESM
        // loader will not resolve (it wants "next/server.js"). Left to Node, any
        // test importing lib/admin/permissions.ts fails to LOAD — that file
        // imports `auth`, which reaches next-auth — so the capability model,
        // which is the authorization core, could not be tested at all.
        //
        // Inlining makes Vite process next-auth, so the alias below applies.
        inline: ["next-auth", "@auth/core"],
      },
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
      // next-auth's env module does `import "next/server"`, which Node cannot
      // resolve as an ESM bare specifier — it wants the explicit ".js". Anything
      // importing lib/admin/permissions.ts therefore failed to LOAD at all,
      // because that file imports `auth`, which reaches next-auth. The capability
      // model — hasPermission, the presets, the whole authorization core — was
      // untestable as a result. Pointing the bare specifier at the real file
      // makes it importable; nothing is stubbed or faked.
      "next/server": "next/server.js",
    },
  },
});

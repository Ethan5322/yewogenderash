/**
 * Runs the vitest suite with the integration tests ENABLED.
 *
 *   node scripts/local-db.mjs 5441          # in another shell, copy the URL
 *   DATABASE_URL=<that url> npm run test:integration
 *
 * Exists because `INTEGRATION_DB=1 vitest run` is not valid on Windows cmd or
 * PowerShell, and pulling in cross-env for one variable is not worth a
 * dependency. Setting it here works on every shell.
 */
import { spawnSync } from "node:child_process";

const url = process.env.DATABASE_URL ?? "";
if (!/@(127\.0\.0\.1|localhost)[:/]/.test(url) || /user:pass@/.test(url)) {
  console.error(
    "Set DATABASE_URL to a LOCAL throwaway database first:\n" +
      "  node scripts/local-db.mjs 5441\n" +
      "then re-run with the URL it prints.\n\n" +
      "These tests write and delete rows — they refuse to run anywhere but localhost."
  );
  process.exit(1);
}

const res = spawnSync(
  process.execPath,
  ["node_modules/vitest/vitest.mjs", "run", ...process.argv.slice(2)],
  { stdio: "inherit", env: { ...process.env, INTEGRATION_DB: "1" } }
);
process.exitCode = res.status ?? 1;

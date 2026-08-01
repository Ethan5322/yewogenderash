import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * No verification code, OTP or password-reset link may be logged in production.
 *
 * All three were being logged unconditionally. A 2FA code in a runtime log is not
 * a second factor, and a password-reset link in a log IS the credential — whoever
 * reads it first owns the account, without the password or the inbox. The worst of
 * the three was the admin one, because those accounts approve payouts.
 *
 * Deliberately a SOURCE check rather than a behavioural one. Proving it by
 * capturing console output would mean importing modules that pull in Prisma and
 * the mailer, and it would only prove the paths the test happened to walk. What
 * needs guaranteeing is simpler and stronger: in these files, a console.log
 * touching a secret is inside a production guard. It also reads as an explanation
 * to whoever is next tempted to add one back for convenience.
 */

const GUARDED_FILES = [
  "lib/auth/otp.ts",
  "lib/auth/password-reset.ts",
  "lib/auth/admin-2fa.ts",
];

/** Things that must never reach a production log. */
const SECRET_TOKENS = [
  "otp.code",
  "params.code",
  "params.link",
  ".code}",
  ".link}",
];

const root = join(__dirname, "..");

describe("secrets are never logged in production", () => {
  for (const file of GUARDED_FILES) {
    it(`${file} guards every console.log that touches a secret`, () => {
      const lines = readFileSync(join(root, file), "utf8").split("\n");

      lines.forEach((line, i) => {
        const isLog = /console\.log\(/.test(line);
        if (!isLog) return;

        // A console.log can be the start of a multi-line template, so look at the
        // statement plus the two lines after it.
        const statement = lines.slice(i, i + 3).join("\n");
        const touchesSecret = SECRET_TOKENS.some((t) => statement.includes(t));
        if (!touchesSecret) return;

        // Walk back for the nearest production guard. Six lines is generous for a
        // guard plus its comment, and short enough that an unguarded log fails.
        const preceding = lines.slice(Math.max(0, i - 6), i).join("\n");
        const guarded = /process\.env\.NODE_ENV\s*!==\s*["']production["']/.test(
          preceding
        );

        expect(
          guarded,
          `${file}:${i + 1} logs a secret with no NODE_ENV guard above it:\n  ${line.trim()}`
        ).toBe(true);
      });
    });
  }

  it("still logs in development, so the fallback remains useful", () => {
    // The guard must be a production check, not a deletion. Losing the dev log
    // would mean nobody can retrieve a code while working without email set up,
    // and the next person would simply add an unguarded one back.
    for (const file of GUARDED_FILES) {
      const src = readFileSync(join(root, file), "utf8");
      expect(src, `${file} lost its development log entirely`).toMatch(
        /NODE_ENV\s*!==\s*["']production["']/
      );
    }
  });
});

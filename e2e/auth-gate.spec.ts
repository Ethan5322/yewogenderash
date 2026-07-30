import { test, expect } from "@playwright/test";

/**
 * The outer auth gate, checked from outside the app.
 *
 * This file exists because of a real incident: adding the CSP to proxy.ts
 * silently disabled Auth.js's `authorized` callback, and /dashboard began
 * rendering for logged-out visitors. Unit tests cannot see that — it only shows
 * up in the HTTP response. These assertions would have caught it immediately.
 *
 * Deliberately requires no credentials: every case here is about what an
 * ANONYMOUS request is allowed to reach, which is the part that must never
 * regress.
 */

const ADMIN_ROUTES = ["/admin", "/admin/payouts", "/admin/team", "/admin/owners"];
const OWNER_ROUTES = ["/dashboard", "/dashboard/payouts", "/dashboard/messages"];
const PUBLIC_ROUTES = ["/", "/campaigns", "/support/fees", "/support/terms", "/blog"];

test.describe("anonymous visitors", () => {
  for (const path of ADMIN_ROUTES) {
    test(`${path} sends a logged-out visitor to the staff sign-in`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} must not render`).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      expect(res.headers()["location"]).toContain("/admin-login");
    });
  }

  for (const path of OWNER_ROUTES) {
    test(`${path} sends a logged-out visitor to sign in`, async ({ request }) => {
      const res = await request.get(path, { maxRedirects: 0 });
      expect(res.status(), `${path} must not render`).toBeGreaterThanOrEqual(300);
      expect(res.status()).toBeLessThan(400);
      const location = res.headers()["location"] ?? "";
      expect(location).toContain("/login");

      // Where they were heading has to survive the round trip — and it has to
      // be the page they actually asked for, not just any callbackUrl.
      //
      // Asserting the VALUE, not merely its presence, because of a regression
      // caught while moving the shared header into app/dashboard/layout.tsx:
      // putting the auth redirect in the layout too looks like sensible
      // de-duplication, but a layout redirect fires before the page's, so every
      // callbackUrl collapsed to /dashboard and someone heading for their
      // payouts signed in and landed somewhere else. The loose `toContain`
      // below passed happily through that.
      const callbackUrl = new URL(location, "http://localhost").searchParams.get(
        "callbackUrl"
      );
      expect(callbackUrl, `${path} must come back to itself after sign-in`).toBe(path);
    });
  }

  for (const path of PUBLIC_ROUTES) {
    test(`${path} is publicly readable`, async ({ request }) => {
      const res = await request.get(path);
      expect(res.status()).toBe(200);
    });
  }

  test("the sign-in pages are reachable without a session", async ({ request }) => {
    for (const path of ["/login", "/admin-login"]) {
      expect((await request.get(path)).status(), path).toBe(200);
    }
  });
});

import { describe, it, expect } from "vitest";
import { shouldHideOwnerCta } from "@/components/site/footer-owner-cta";

/**
 * Who is shown "Are you a campaign owner? Sign in to manage your campaigns".
 *
 * The bug this fixes: a fundraiser signed into their own account was being asked
 * that at the bottom of every screen, as though the site had forgotten who was
 * reading it. Being signed in is the condition, not the URL — a path list would
 * have missed a signed-in fundraiser browsing /campaigns.
 *
 * Both directions are tested. A panel that is hidden from everyone is as broken as
 * one shown to everyone: it is the only route into registration from the footer.
 */
describe("shouldHideOwnerCta", () => {
  const dashboardPaths = [
    "/dashboard",
    "/dashboard/payouts",
    "/dashboard/campaigns",
    "/dashboard/campaigns/abc/transactions",
    "/dashboard/settings",
    "/dashboard/id",
  ];

  it("is hidden everywhere for someone signed in", () => {
    for (const pathname of [...dashboardPaths, "/campaigns", "/blog", "/support", "/a/AC-123"]) {
      expect(
        shouldHideOwnerCta({ signedIn: true, pathname }),
        `signed-in user should not be asked to sign in on ${pathname}`
      ).toBe(true);
    }
  });

  it("is hidden on the homepage, which has its own call to action", () => {
    expect(shouldHideOwnerCta({ signedIn: false, pathname: "/" })).toBe(true);
  });

  it("is hidden inside the auth and registration flow", () => {
    for (const pathname of [
      "/login",
      "/register",
      "/start",
      "/start/verify",
      "/admin-login",
    ]) {
      expect(shouldHideOwnerCta({ signedIn: false, pathname }), pathname).toBe(true);
    }
  });

  it("IS shown to an anonymous visitor on ordinary pages", () => {
    // The other half. This is the footer's only path into registration, so
    // over-hiding it silently removes the way new fundraisers sign up.
    for (const pathname of [
      "/campaigns",
      "/campaigns/some-slug",
      "/blog",
      "/support",
      "/support/fees",
      "/a/AC-123",
      "/q/QC-123",
    ]) {
      expect(
        shouldHideOwnerCta({ signedIn: false, pathname }),
        `anonymous visitor should still be offered registration on ${pathname}`
      ).toBe(false);
    }
  });

  it("does not hide on a path that merely contains a hidden word", () => {
    // startsWith, not includes: a campaign called "restart-the-clinic" must not
    // knock the panel out of the footer of its own page.
    expect(
      shouldHideOwnerCta({ signedIn: false, pathname: "/campaigns/restart-the-clinic" })
    ).toBe(false);
    expect(
      shouldHideOwnerCta({ signedIn: false, pathname: "/blog/how-to-register" })
    ).toBe(false);
  });
});

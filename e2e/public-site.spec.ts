import { test, expect } from "@playwright/test";

/**
 * The public site's promises, checked in a real browser.
 *
 * Each assertion here corresponds to something that actually went wrong and was
 * fixed: canonical tags all pointing at the homepage, the fee percentages
 * drifting from what the code charges, the trust seal rendering gold instead of
 * brand green, and the header ignoring the chosen language.
 */

test.describe("SEO", () => {
  const pages: [string, string][] = [
    ["/", ""],
    ["/campaigns", "/campaigns"],
    ["/blog", "/blog"],
    ["/support", "/support"],
    ["/support/fees", "/support/fees"],
  ];

  for (const [path, expectedSuffix] of pages) {
    test(`${path} declares its own canonical, not the homepage`, async ({ page }) => {
      await page.goto(path);
      const href = await page
        .locator('link[rel="canonical"]')
        .first()
        .getAttribute("href");
      expect(href, `${path} has no canonical`).toBeTruthy();
      // A page claiming to be "/" when it is not is the bug this guards.
      expect(new URL(href!).pathname.replace(/\/$/, "")).toBe(expectedSuffix);
    });
  }

  for (const path of ["/", "/campaigns", "/support/fees"]) {
    test(`${path} has exactly one h1`, async ({ page }) => {
      await page.goto(path);
      await expect(page.locator("h1")).toHaveCount(1);
    });
  }
});

test.describe("fees", () => {
  test("the fee page states the real split and reconciles to 100", async ({ page }) => {
    await page.goto("/support/fees");
    const body = await page.locator("body").innerText();
    // 3 + 97 credited, 7 withheld, 90 reaching the fundraiser.
    for (const amount of ["ETB 3", "ETB 97", "ETB 7", "ETB 90"]) {
      expect(body, `fees page missing ${amount}`).toContain(amount);
    }
    expect(body).toContain("once per campaign");
  });

  test("the homepage does NOT carry the fee breakdown", async ({ page }) => {
    // Deliberate product decision: fees live on the fees page and the donate
    // step, not the front page.
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /what happens to your donation/i })
    ).toHaveCount(0);
  });
});

test.describe("trust marks", () => {
  test("the Mulesoo seal is brand green, not gold", async ({ page }) => {
    await page.goto("/campaigns");
    const badge = page.locator('[title="Mulesoo verified owner"]').first();
    if ((await badge.count()) === 0) test.skip(true, "no verified campaign published");
    const bg = await badge.evaluate((el) => getComputedStyle(el).backgroundColor);
    // Brand green #0f7a4d; the bug was gold #b9820f (red channel far higher).
    const [r, g] = bg.match(/\d+/g)!.map(Number);
    expect(g, `seal background is ${bg}`).toBeGreaterThan(r);
  });
});

test.describe("language", () => {
  test("the site switches to Amharic and marks the document lang", async ({ page, context }) => {
    await context.addCookies([
      { name: "locale", value: "am", url: "http://localhost:3000" },
    ]);
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "am");
    // Ethiopic script must actually appear — not just the lang attribute.
    const body = await page.locator("body").innerText();
    expect(body).toMatch(/[ሀ-፿]/);
  });

  test("English stays English", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");
  });
});

test.describe("security headers", () => {
  test("a CSP with a per-request nonce is sent", async ({ request }) => {
    const res = await request.get("/");
    const headers = res.headers();
    const csp =
      headers["content-security-policy"] ??
      headers["content-security-policy-report-only"];
    expect(csp, "no CSP header at all").toBeTruthy();
    expect(csp).toContain("nonce-");
    expect(csp).toContain("frame-ancestors 'none'");
    // Face recognition would break silently without these.
    expect(csp).toContain("cdn.jsdelivr.net");
    expect(csp).toContain("wasm-unsafe-eval");
  });

  test("the nonce changes between requests", async ({ request }) => {
    const grab = async () => {
      const h = (await request.get("/")).headers();
      const csp =
        h["content-security-policy"] ?? h["content-security-policy-report-only"] ?? "";
      return /nonce-([a-f0-9]+)/.exec(csp)?.[1];
    };
    const [a, b] = [await grab(), await grab()];
    expect(a).toBeTruthy();
    expect(a, "nonce is being reused across requests").not.toBe(b);
  });

  test("baseline hardening headers are present", async ({ request }) => {
    const h = (await request.get("/")).headers();
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
  });
});

test.describe("console health", () => {
  /**
   * Asserts on UNCAUGHT CLIENT exceptions only.
   *
   * `console.error` is deliberately not a failure: in dev, Next forwards server
   * logs into the browser console, so a transient "can't reach database server"
   * from Supabase's pooler — which the app handles correctly by falling back to
   * default content — would fail a test about client-side health. A genuine
   * broken page throws, and that is what this catches.
   */
  for (const path of ["/", "/campaigns", "/support/fees"]) {
    test(`${path} throws no uncaught client errors`, async ({ page }) => {
      const crashes: string[] = [];
      page.on("pageerror", (e) => crashes.push(e.message));
      await page.goto(path, { waitUntil: "domcontentloaded" });
      expect(crashes, `uncaught errors on ${path}`).toEqual([]);
    });
  }
});

test.describe("footer owner call-to-action", () => {
  /**
   * The half of the fix that could break quietly.
   *
   * The panel was being shown to signed-in fundraisers inside their own account,
   * which reads as the site not knowing who they are. Hiding it is now driven by
   * the session (see shouldHideOwnerCta), and the signed-in case is covered by
   * unit tests — proving it in a browser would mean creating a fundraiser account
   * in the real database this dev server talks to.
   *
   * What a browser CAN prove without an account is the opposite direction: an
   * anonymous visitor must still be offered registration, because this panel is
   * the footer's only route into it. Over-hiding it would remove the sign-up path
   * for every new fundraiser and break nothing that any other test looks at.
   */
  test("an anonymous visitor is still invited to register", async ({ page }) => {
    await page.goto("/campaigns", { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    expect(body).toContain("Are you a campaign owner?");
    await expect(
      page.locator('footer a[href="/start"]').first()
    ).toBeVisible();
  });

  test("the homepage does not repeat it — it has its own call to action", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Are you a campaign owner?");
  });

  test("the sign-in page does not ask you to sign in again", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    const body = await page.locator("body").innerText();
    expect(body).not.toContain("Are you a campaign owner?");
  });
});

import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * Allows all crawlers — including AI assistants (GPTBot, ClaudeBot,
 * Google-Extended, PerplexityBot, etc., covered by the "*" allow) — so the
 * public site can be indexed and cited, while private/functional areas stay out.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin-login",
          "/dashboard",
          "/api/",
          "/q/",
          "/a/",
          "/capture/",
          "/donate/thanks",
          "/start/",
          "/login",
          "/register",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/lib/seo";

export const revalidate = 3600; // refresh hourly

/** Static pages + every public campaign + published blog post. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths = [
    "",
    "/campaigns",
    "/start",
    "/blog",
    "/support",
    "/support/faq",
    "/support/fees",
    "/support/terms",
    "/support/privacy",
    "/support/contact",
  ].map((p) => ({
    url: `${SITE_URL}${p}`,
    lastModified: new Date(),
    changeFrequency: (p === "" || p === "/campaigns" ? "daily" : "weekly") as
      | "daily"
      | "weekly",
    priority: p === "" ? 1 : p === "/campaigns" ? 0.9 : 0.6,
  }));

  let dynamic: MetadataRoute.Sitemap = [];
  try {
    const [campaigns, posts] = await Promise.all([
      db.campaign.findMany({
        where: { status: { in: ["ACTIVE", "COMPLETED"] } },
        select: { slug: true, updatedAt: true },
        orderBy: { updatedAt: "desc" },
        take: 5000,
      }),
      db.blogPost.findMany({
        where: { publishedAt: { not: null } },
        select: { slug: true, updatedAt: true },
        take: 1000,
      }),
    ]);
    dynamic = [
      ...campaigns.map((c) => ({
        url: `${SITE_URL}/campaigns/${c.slug}`,
        lastModified: c.updatedAt,
        changeFrequency: "daily" as const,
        priority: 0.8,
      })),
      ...posts.map((p) => ({
        url: `${SITE_URL}/blog/${p.slug}`,
        lastModified: p.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.5,
      })),
    ];
  } catch {
    // DB unavailable at build — static entries still ship.
  }

  return [...staticPaths, ...dynamic];
}

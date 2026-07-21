import "server-only";
import { db } from "@/lib/db";

/** URL-safe slug from a title (ASCII, hyphenated, deduped elsewhere). */
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Published posts for the public blog index, newest first. */
export function listPublishedPosts() {
  return db.blogPost.findMany({
    where: { status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      slug: true,
      title: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
    },
  });
}

/** A single published post by slug (public). */
export function getPublishedPost(slug: string) {
  return db.blogPost.findFirst({
    where: { slug, status: "PUBLISHED" },
    select: {
      title: true,
      body: true,
      excerpt: true,
      coverImageUrl: true,
      publishedAt: true,
      author: { select: { name: true } },
    },
  });
}

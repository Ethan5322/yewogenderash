import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/blog";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Updates, guides, and stories from Yewogen Derash — how verified fundraising works in Ethiopia.",
};

// Public copy should reflect the latest published posts.
export const dynamic = "force-dynamic";

export default async function BlogIndexPage() {
  const posts = await listPublishedPosts();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
      <header className="max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Blog
        </h1>
        <p className="mt-3 text-muted-foreground">
          Guides, platform updates, and stories about trusted fundraising in
          Ethiopia.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="mt-10 text-muted-foreground">
          No posts published yet — check back soon.
        </p>
      ) : (
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/blog/${post.slug}`}
              className="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-shadow hover:shadow-md"
            >
              {post.coverImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.coverImageUrl}
                  alt=""
                  className="aspect-[16/9] w-full object-cover"
                />
              ) : (
                <div className="aspect-[16/9] w-full bg-gradient-to-br from-primary/10 to-secondary/20" />
              )}
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-semibold leading-snug group-hover:text-primary">
                  {post.title}
                </h2>
                <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
                  {post.excerpt}
                </p>
                {post.publishedAt ? (
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDate(post.publishedAt)}
                  </p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

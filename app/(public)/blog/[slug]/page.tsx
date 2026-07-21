import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getPublishedPost } from "@/lib/blog";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) return { title: "Post not found" };
  return { title: post.title, description: post.excerpt };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  if (!post) notFound();

  const paragraphs = post.body.split(/\n{2,}/).filter((p) => p.trim());

  return (
    <article className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6">
      <Link
        href="/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All posts
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
        {post.title}
      </h1>
      <p className="mt-3 text-sm text-muted-foreground">
        {post.author?.name ? `${post.author.name} · ` : ""}
        {post.publishedAt ? formatDate(post.publishedAt) : ""}
      </p>

      {post.coverImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={post.coverImageUrl}
          alt=""
          className="mt-6 w-full rounded-xl border object-cover"
        />
      ) : null}

      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-foreground/90">
        {paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </article>
  );
}

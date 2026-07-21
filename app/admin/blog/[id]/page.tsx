import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { BlogEditor } from "@/components/admin/blog-editor";
import { BlogPostControls } from "@/components/admin/blog-post-controls";

export const metadata = { title: "Edit post" };

export default async function EditBlogPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("content");
  const { id } = await params;

  const post = await db.blogPost.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      excerpt: true,
      body: true,
      coverImageUrl: true,
      slug: true,
      status: true,
    },
  });
  if (!post) notFound();

  const published = post.status === "PUBLISHED";

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Blog
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">Edit post</h1>
        <div className="flex items-center gap-3">
          {published ? (
            <Link
              href={`/blog/${post.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> View
            </Link>
          ) : null}
          <BlogPostControls postId={post.id} published={published} />
        </div>
      </div>

      <BlogEditor
        postId={post.id}
        initial={{
          title: post.title,
          excerpt: post.excerpt,
          body: post.body,
          coverImageUrl: post.coverImageUrl ?? "",
        }}
      />
    </div>
  );
}

import Link from "next/link";
import { Plus, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Blog" };

export default async function AdminBlogPage() {
  await requirePermission("content");
  const posts = await db.blogPost.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      slug: true,
      updatedAt: true,
      publishedAt: true,
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Blog</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trust content, guides, and success stories for the public site.
          </p>
        </div>
        <Button asChild size="sm">
          <Link href="/admin/blog/new">
            <Plus className="h-4 w-4" aria-hidden /> New post
          </Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <p className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">
          No posts yet. Create your first post to start building trust content.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {posts.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/blog/${p.id}`}
                className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-medium">{p.title}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                        p.status === "PUBLISHED"
                          ? "bg-success/10 text-success"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {p.status}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Updated {formatDate(p.updatedAt)}
                    {p.publishedAt ? ` · published ${formatDate(p.publishedAt)}` : ""} · /{p.slug}
                  </span>
                </span>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

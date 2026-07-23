import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requirePermission } from "@/lib/admin/permissions";
import { BlogEditor } from "@/components/admin/blog-editor";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "New post" };

export default async function NewBlogPostPage() {
  await requirePermission("content");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/blog"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Blog
      </Link>
      <PageHeader
        title="New post"
        description="Posts start as a draft. You can publish them after saving."
      />
      <BlogEditor />
    </div>
  );
}

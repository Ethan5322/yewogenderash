import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CONTENT_REGISTRY, getRawContent, isContentKey } from "@/lib/content";
import { requirePermission } from "@/lib/admin/permissions";
import { ContentEditorForm } from "@/components/admin/content-editor-form";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "Edit content" };

export default async function EditContentPage({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  await requirePermission("content");
  const { key } = await params;
  if (!isContentKey(key)) notFound();

  const entry = CONTENT_REGISTRY[key];
  const value = await getRawContent(key);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/admin/content"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All content
      </Link>

      <div>
        <PageHeader title={entry.label} description={entry.description} />
      </div>

      <ContentEditorForm
        contentKey={key}
        initialValue={JSON.stringify(value, null, 2)}
        defaultValue={JSON.stringify(entry.default, null, 2)}
      />
    </div>
  );
}

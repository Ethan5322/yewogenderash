import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { contentMeta } from "@/lib/content";
import { requirePermission } from "@/lib/admin/permissions";
import { PageHeader } from "@/components/admin/ui";

export const metadata = { title: "CMS / Pages" };

export default async function AdminContentPage() {
  await requirePermission("content");
  const blocks = contentMeta();

  return (
    <div>
      <PageHeader
        title="CMS / Pages"
        description="Edit copy shown on the public site (home, about, FAQ, fees, terms, privacy, contact and more). Changes take effect immediately."
      />

      <ul className="divide-y rounded-lg border bg-card">
        {blocks.map((block) => (
          <li key={block.key}>
            <Link
              href={`/admin/content/${block.key}`}
              className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-muted/50"
            >
              <span>
                <span className="block font-medium">{block.label}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {block.description}
                </span>
                <span className="mt-1 block font-mono text-xs text-muted-foreground/70">
                  {block.key}
                </span>
              </span>
              <ChevronRight
                className="h-5 w-5 shrink-0 text-muted-foreground"
                aria-hidden
              />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

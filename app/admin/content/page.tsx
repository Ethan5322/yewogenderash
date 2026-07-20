import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { contentMeta } from "@/lib/content";
import { requirePermission } from "@/lib/admin/permissions";

export const metadata = { title: "Site content" };

export default async function AdminContentPage() {
  await requirePermission("content");
  const blocks = contentMeta();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">
          Site content
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Edit copy shown on the public site. Changes take effect immediately.
        </p>
      </div>

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

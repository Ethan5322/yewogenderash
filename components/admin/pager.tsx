import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Server-rendered pager for admin lists. `baseParams` carries the current
 * filters (status, q, …) so paging preserves them; only `page` changes.
 */
export function Pager({
  basePath,
  baseParams,
  page,
  pageSize,
  total,
}: {
  basePath: string;
  baseParams?: Record<string, string | undefined>;
  page: number;
  pageSize: number;
  total: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;

  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseParams ?? {})) {
      if (v) sp.set(k, v);
    }
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-2">
        <PagerLink href={href(page - 1)} disabled={page <= 1} label="Previous">
          <ChevronLeft className="h-4 w-4" aria-hidden />
        </PagerLink>
        <span className="text-muted-foreground">
          Page {page} of {pages}
        </span>
        <PagerLink href={href(page + 1)} disabled={page >= pages} label="Next">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </PagerLink>
      </div>
    </div>
  );
}

function PagerLink({
  href,
  disabled,
  label,
  children,
}: {
  href: string;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  const cls =
    "inline-flex h-8 w-8 items-center justify-center rounded-md border border-input";
  if (disabled) {
    return (
      <span className={`${cls} pointer-events-none opacity-40`} aria-hidden>
        {children}
      </span>
    );
  }
  return (
    <Link href={href} aria-label={label} className={`${cls} transition-colors hover:bg-accent`}>
      {children}
    </Link>
  );
}

/** Clamp a raw `page` query param to a positive integer. */
export function pageFrom(value: unknown): number {
  const n = typeof value === "string" ? parseInt(value, 10) : 1;
  return Number.isFinite(n) && n > 0 ? n : 1;
}

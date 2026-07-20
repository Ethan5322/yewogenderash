import { cn } from "@/lib/utils";

/** Placeholder shimmer for content that is still loading. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

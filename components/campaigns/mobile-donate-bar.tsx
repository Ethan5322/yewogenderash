import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { formatETB } from "@/lib/format";

/**
 * Sticky donate bar for phones — keeps the primary action pinned so a donor
 * never has to scroll back up. Hidden on lg+ where the sticky sidebar covers it.
 */
export function MobileDonateBar({
  slug,
  raised,
  currency,
  pct,
  donateLabel = "Donate securely",
}: {
  slug: string;
  raised: number;
  currency: string;
  pct: number;
  donateLabel?: string;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur shadow-[0_-4px_20px_rgba(0,0,0,0.07)] lg:hidden">
      <div className="mx-auto max-w-6xl px-4 py-2.5">
        <ProgressBar value={pct} className="mb-2" />
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">
              {formatETB(raised, currency)}
            </p>
            <p className="text-xs leading-tight text-muted-foreground">{pct}% funded</p>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href={`/campaigns/${slug}/donate`}>{donateLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

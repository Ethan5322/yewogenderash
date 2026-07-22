import Link from "next/link";
import { BadgeCheck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * The Mulesoo stamp — the platform's trust seal. Rendered only when an owner
 * has been admin-approved (`mulesooVerified`); never user-editable.
 */
export function MulesooStamp({ className }: { className?: string }) {
  return (
    <Badge variant="gold" className={cn("gap-1", className)} title="Mulesoo verified owner">
      <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
      Mulesoo verified
    </Badge>
  );
}

/**
 * Owner trust line: verified stamp when approved, otherwise a neutral owner
 * label. When an authorCode is supplied the verified badge links to the owner's
 * public verification profile (scan-to-verify).
 */
export function OwnerTrust({
  ownerName,
  mulesooVerified,
  authorCode,
  className,
  byLabel = "by",
  verifiedLabel = "Verified owner",
}: {
  ownerName: string;
  mulesooVerified: boolean;
  authorCode?: string | null;
  className?: string;
  byLabel?: string;
  verifiedLabel?: string;
}) {
  const badge = (
    <Badge variant="verified" className="gap-1">
      <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
      {verifiedLabel}
    </Badge>
  );
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">{byLabel}</span>
      <span className="font-medium text-foreground">{ownerName}</span>
      {mulesooVerified ? (
        authorCode ? (
          <Link
            href={`/a/${authorCode}`}
            className="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2"
            title="View verification profile"
          >
            {badge}
          </Link>
        ) : (
          badge
        )
      ) : null}
    </div>
  );
}

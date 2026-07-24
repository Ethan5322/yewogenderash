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
 * Owner trust line: a verified stamp when approved, otherwise a neutral owner
 * label. The badge is a plain, NON-clickable trust seal — it deliberately never
 * links anywhere and never exposes the fundraiser's verification code or ID.
 * Those are private login credentials; publishing them would let anyone attempt
 * to impersonate or sign in as the fundraiser.
 */
export function OwnerTrust({
  ownerName,
  mulesooVerified,
  className,
  byLabel = "by",
  verifiedLabel = "Verified owner",
}: {
  ownerName: string;
  mulesooVerified: boolean;
  className?: string;
  byLabel?: string;
  verifiedLabel?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <span className="text-muted-foreground">{byLabel}</span>
      <span className="font-medium text-foreground">{ownerName}</span>
      {mulesooVerified ? (
        <Badge variant="verified" className="gap-1">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
          {verifiedLabel}
        </Badge>
      ) : null}
    </div>
  );
}

import type { CampaignStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const STATUS_META: Record<
  CampaignStatus,
  { label: string; variant: "default" | "secondary" | "verified" | "gold" | "warning" | "destructive" | "outline" }
> = {
  DRAFT: { label: "Draft", variant: "secondary" },
  PENDING_REVIEW: { label: "Pending review", variant: "warning" },
  ACTIVE: { label: "Active", variant: "verified" },
  SUSPENDED: { label: "Suspended", variant: "destructive" },
  COMPLETED: { label: "Completed", variant: "default" },
  ARCHIVED: { label: "Archived", variant: "outline" },
  REJECTED: { label: "Rejected", variant: "destructive" },
};

export function StatusBadge({ status }: { status: CampaignStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

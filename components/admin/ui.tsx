import Link from "next/link";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Corporate admin UI kit — shared primitives for a dense, finance-grade
 * back office. Server-compatible (no client hooks) so every admin page
 * can compose them directly.
 * ------------------------------------------------------------------ */

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const TONE_SOFT: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  success: "bg-success/10 text-success ring-success/20",
  warning: "bg-warning/10 text-warning ring-warning/20",
  danger: "bg-destructive/10 text-destructive ring-destructive/20",
  info: "bg-primary/10 text-primary ring-primary/20",
  brand: "bg-primary/10 text-primary ring-primary/20",
};

/** Page title + description + right-aligned action slot. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-5">
      <div className="min-w-0">
        <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Filter/search row that sits above a table. */
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3", className)}>
      {children}
    </div>
  );
}

/** A compact status/label chip. */
export function Chip({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_SOFT[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Maps a raw status string to a toned chip. Shared across every module so a
 * status always reads the same colour wherever it appears. */
const STATUS_TONE: Record<string, Tone> = {
  // campaigns
  ACTIVE: "success", PENDING_REVIEW: "warning", DRAFT: "neutral",
  SUSPENDED: "danger", REJECTED: "danger", ARCHIVED: "neutral", COMPLETED: "info",
  // donations / payments
  SUCCESS: "success", PENDING: "warning", FAILED: "neutral",
  CANCELLED: "neutral", REFUNDED: "warning", DISPUTED: "danger",
  // payouts
  REQUESTED: "warning", APPROVED: "info", PAID: "success",
  // kyc
  VERIFIED: "success", UNVERIFIED: "neutral",
  // support
  OPEN: "warning", RESOLVED: "success",
  // notifications
  SENT: "success", QUEUED: "warning",
};

export function StatusChip({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? "neutral";
  const label = status
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
  return <Chip tone={tone}>{label}</Chip>;
}

/** A KPI stat card. Optionally a link and a coloured emphasis. */
export function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/30">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-7 w-7 items-center justify-center rounded-md",
              TONE_SOFT[tone]
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-display text-2xl font-bold tracking-tight">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {body}
    </Link>
  ) : (
    body
  );
}

/** A titled panel/card with an optional action slot. */
export function SectionCard({
  title,
  sub,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: string;
  sub?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-sm", className)}>
      {title || actions ? (
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            {title ? <h2 className="text-sm font-semibold">{title}</h2> : null}
            {sub ? <p className="text-xs text-muted-foreground">{sub}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      ) : null}
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Scroll-safe frame around a data table. */
export function TableFrame({
  children,
  minWidth = 860,
}: {
  children: React.ReactNode;
  minWidth?: number;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
      <table className="w-full text-sm" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
        {children}
      </tr>
    </thead>
  );
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn("px-4 py-3 font-medium", className)}>{children}</th>;
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        {children}
      </td>
    </tr>
  );
}

/** Small ghost/secondary button styled as a link (for toolbars). */
export function ToolbarLink({
  href,
  children,
  icon: Icon,
}: {
  href: string;
  children: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
    >
      {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
      {children}
    </Link>
  );
}

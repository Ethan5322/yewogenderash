import { cn } from "@/lib/utils";

/** Accessible funding progress bar. `value` is an already-clamped 0–100 int. */
export function ProgressBar({
  value,
  className,
  label,
}: {
  value: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label ?? "Funding progress"}
      className={cn(
        "h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
    >
      <div
        className="h-full rounded-full bg-primary transition-[width] duration-500"
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

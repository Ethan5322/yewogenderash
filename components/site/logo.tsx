import Link from "next/link";
import { HandHeart } from "lucide-react";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("flex items-center gap-2 font-display", className)}
      aria-label="Yewogen Derash — home"
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <HandHeart className="h-5 w-5" aria-hidden />
      </span>
      <span className="text-lg font-bold leading-none tracking-tight">
        Yewogen <span className="text-primary">Derash</span>
      </span>
    </Link>
  );
}

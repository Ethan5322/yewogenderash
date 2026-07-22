"use client";

import { useRouter } from "next/navigation";
import { RefreshCw, Printer } from "lucide-react";

/** Client actions for the dashboard header: live refresh + print-to-PDF. */
export function DashboardToolbar() {
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={() => router.refresh()}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
      >
        <RefreshCw className="h-4 w-4" aria-hidden /> Refresh
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
      >
        <Printer className="h-4 w-4" aria-hidden /> Export PDF
      </button>
    </>
  );
}

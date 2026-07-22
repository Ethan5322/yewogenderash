import { Loader2 } from "lucide-react";

/** Instant loading state for auth pages so there's no blank wait while the
 * route streams in — the shell (header) paints immediately. */
export default function AuthLoading() {
  return (
    <div className="flex w-full max-w-md items-center justify-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />
    </div>
  );
}

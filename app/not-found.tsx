import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-1 flex-col items-center justify-center px-4 py-20 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground">
        <Compass className="h-7 w-7" aria-hidden />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold tracking-tight">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-muted-foreground">
        The page or campaign you&apos;re looking for doesn&apos;t exist, or is no
        longer public.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild>
          <Link href="/campaigns">Browse campaigns</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go home</Link>
        </Button>
      </div>
    </div>
  );
}

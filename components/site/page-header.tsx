export function PageHeader({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
}) {
  return (
    <header className="mb-8">
      {eyebrow ? (
        <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">
          {eyebrow}
        </p>
      ) : null}
      <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-3 max-w-2xl text-muted-foreground">{description}</p>
      ) : null}
    </header>
  );
}

/** Lightweight prose styling (no typography plugin) for legal/help content. */
export function Prose({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl space-y-4 leading-relaxed text-foreground/90 [&_h2]:mt-8 [&_h2]:font-display [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_h3]:mt-6 [&_h3]:font-semibold [&_h3]:text-foreground [&_p]:text-foreground/80 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5 [&_ul]:text-foreground/80 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2">
      {children}
    </div>
  );
}

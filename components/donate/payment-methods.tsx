import { Smartphone, Landmark, CreditCard, Globe } from "lucide-react";

type Copy = {
  methodsTitle: string;
  methodsSub: string;
  methodsLocal: string;
  methodsCard: string;
  methodsNote: string;
};

/**
 * Which payment rails actually work, named.
 *
 * "Local & international payments" told a donor nothing — someone deciding
 * whether to give needs to know their own method is accepted, and a diaspora
 * donor needs to know a foreign card will work at all.
 *
 * The wording stays honest about the one thing we cannot promise from here: what
 * a given donor will be offered is decided by the gateway at checkout, so this
 * says that rather than guaranteeing a specific method.
 */
export function PaymentMethods({ copy }: { copy: Copy }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-sm">
      <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
        <CreditCard className="h-4 w-4 text-primary" aria-hidden />
        {copy.methodsTitle}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{copy.methodsSub}</p>

      <ul className="mt-4 space-y-3 text-sm">
        <li className="flex items-start gap-2.5">
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{copy.methodsLocal}</span>
        </li>
        <li className="flex items-start gap-2.5">
          <Globe className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>{copy.methodsCard}</span>
        </li>
      </ul>

      <p className="mt-4 flex items-start gap-2 border-t pt-3 text-xs text-muted-foreground">
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {copy.methodsNote}
      </p>
    </section>
  );
}

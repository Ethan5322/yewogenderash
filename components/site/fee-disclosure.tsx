import Link from "next/link";
import { Receipt, HandCoins, ShieldCheck, ArrowRight } from "lucide-react";
import { PLATFORM_FEE_RATE, WITHHOLDING_FEE_RATE } from "@/lib/fees";

type Copy = {
  title: string;
  sub: string;
  donationLabel: string;
  transactionFee: string;
  transactionFeeDesc: string;
  toCampaign: string;
  toCampaignDesc: string;
  withholding: string;
  withholdingDesc: string;
  fundraiserReceives: string;
  readMore: string;
};

const pct = (rate: number) => Math.round(rate * 100);

/**
 * Public, plain-language statement of both deductions, shown BEFORE anyone
 * donates.
 *
 * Every figure is derived from the rates in lib/fees.ts, so the public promise
 * can never drift from what the code actually charges — change a rate and this
 * copy follows. Worked on a round ETB 100 so the arithmetic is obvious at a
 * glance rather than something a donor has to trust.
 */
export function FeeDisclosure({ copy }: { copy: Copy }) {
  const feePct = pct(PLATFORM_FEE_RATE);
  const holdPct = pct(WITHHOLDING_FEE_RATE);
  const creditedPct = 100 - feePct;
  const receivesPct = 100 - feePct - holdPct;

  const rows = [
    {
      icon: Receipt,
      label: copy.transactionFee,
      desc: copy.transactionFeeDesc,
      amount: `− ETB ${feePct}`,
      tone: "text-muted-foreground",
    },
    {
      icon: HandCoins,
      label: copy.toCampaign,
      desc: copy.toCampaignDesc,
      amount: `ETB ${creditedPct}`,
      tone: "text-foreground",
    },
    {
      icon: ShieldCheck,
      label: `${copy.withholding} (${holdPct}%)`,
      desc: copy.withholdingDesc,
      amount: `− ETB ${holdPct}`,
      tone: "text-muted-foreground",
    },
  ];

  return (
    <section className="border-t bg-card">
      <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6 sm:py-16">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight sm:text-3xl">
          {copy.title}
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-sm text-muted-foreground sm:text-base">
          {copy.sub}
        </p>

        <div className="mt-10 overflow-hidden rounded-xl border bg-background shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b bg-muted/40 px-5 py-3">
            <p className="text-sm font-semibold">{copy.donationLabel}</p>
            <p className="font-display text-lg font-bold tabular-nums">ETB 100</p>
          </div>

          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.label} className="flex items-start gap-3 px-5 py-4">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
                  <r.icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p>
                </div>
                <p className={`shrink-0 text-sm font-semibold tabular-nums ${r.tone}`}>
                  {r.amount}
                </p>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between gap-4 border-t bg-primary/5 px-5 py-4">
            <p className="text-sm font-semibold">{copy.fundraiserReceives}</p>
            <p className="font-display text-xl font-bold tabular-nums text-primary">
              ETB {receivesPct}
            </p>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          <Link href="/support/fees" className="font-medium text-primary hover:underline">
            {copy.readMore} <ArrowRight className="inline h-3 w-3" aria-hidden />
          </Link>
        </p>
      </div>
    </section>
  );
}

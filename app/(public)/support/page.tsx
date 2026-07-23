import type { Metadata } from "next";
import Link from "next/link";
import {
  Receipt,
  FileText,
  ShieldCheck,
  HelpCircle,
  Mail,
  Flag,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Support & legal",
  description:
    "Fees, policies, FAQs, and contact information for Yewogen Derash — transparency you can verify.",
};

const CARDS = [
  { href: "/support/fees", icon: Receipt, key: "fees" },
  { href: "/support/faq", icon: HelpCircle, key: "faq" },
  { href: "/support/terms", icon: FileText, key: "terms" },
  { href: "/support/privacy", icon: ShieldCheck, key: "privacy" },
  { href: "/support/contact", icon: Mail, key: "contact" },
  { href: "/support/report", icon: Flag, key: "report" },
] as const;

export default async function SupportPage() {
  const { support: t } = await getDictionary();
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader eyebrow={t.eyebrow} title={t.title} description={t.description} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => {
          const c = t.cards[card.key];
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col rounded-lg border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
            >
              <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <card.icon className="h-5 w-5" aria-hidden />
              </span>
              <h2 className="font-display text-base font-semibold group-hover:text-primary">
                {c.title}
              </h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.desc}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                {t.readMore} <ArrowRight className="h-4 w-4" aria-hidden />
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

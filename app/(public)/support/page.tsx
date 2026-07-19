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

export const metadata: Metadata = {
  title: "Support & legal",
  description:
    "Fees, policies, FAQs, and contact information for Yewogen Derash — transparency you can verify.",
};

const CARDS = [
  {
    href: "/support/fees",
    icon: Receipt,
    title: "Fees & payouts",
    description: "How hosting and platform fees work, and when funds are paid out.",
  },
  {
    href: "/support/faq",
    icon: HelpCircle,
    title: "FAQ",
    description: "Common questions from donors and campaign owners.",
  },
  {
    href: "/support/terms",
    icon: FileText,
    title: "Terms & conditions",
    description: "The rules that govern the use of Yewogen Derash.",
  },
  {
    href: "/support/privacy",
    icon: ShieldCheck,
    title: "Privacy policy",
    description: "How we collect, use, and protect your personal and biometric data.",
  },
  {
    href: "/support/contact",
    icon: Mail,
    title: "Contact us",
    description: "Reach the Yewogen Derash support team.",
  },
  {
    href: "/support/report",
    icon: Flag,
    title: "Report abuse",
    description: "Flag a campaign or owner you believe is fraudulent.",
  },
] as const;

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Support"
        title="Help & legal centre"
        description="Everything you need to understand how Yewogen Derash keeps fundraising transparent, verified, and safe."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group flex flex-col rounded-lg border bg-card p-6 shadow-sm transition-all hover:border-primary/40 hover:shadow-md"
          >
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-accent-foreground">
              <card.icon className="h-5 w-5" aria-hidden />
            </span>
            <h2 className="font-display text-base font-semibold group-hover:text-primary">
              {card.title}
            </h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              {card.description}
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
              Read more <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

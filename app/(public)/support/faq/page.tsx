import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions from donors and campaign owners.",
};

const FAQS = [
  {
    q: "How do I know a campaign is genuine?",
    a: "Every campaign owner completes identity verification — ID document upload and a live face capture — and passes manual administrator review before their campaign goes live. Verified campaigns show a Mulesoo trust seal and the owner's verification code.",
  },
  {
    q: "Where does my donation go?",
    a: "Each campaign has its own separated ledger. Your donation is tied to exactly one campaign and is never pooled with others. A campaign's querycode and QR always point to that single campaign.",
  },
  {
    q: "What is a querycode?",
    a: "A querycode is a unique short code assigned to each campaign. Scanning its QR code or entering the code takes you straight to that campaign's donation page — it can never point to more than one campaign.",
  },
  {
    q: "How are payouts handled?",
    a: "Campaign owners request payouts, and every payout is reviewed and approved by an administrator before funds are released. Owners cannot self-release funds. Every payout is recorded and audited.",
  },
  {
    q: "How do I start a campaign?",
    a: "Create an account, verify your email and phone, accept the terms and fee policy, upload your identity and supporting documents, and complete face verification. Once an administrator approves you, you can create campaigns.",
  },
  {
    q: "Can I donate anonymously?",
    a: "Yes. When donating you can choose to hide your name from the public supporters list. Your payment is still processed securely.",
  },
] as const;

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Help"
        title="Frequently asked questions"
        description="Can't find what you're looking for? Reach us on the contact page."
      />

      <div className="divide-y rounded-lg border">
        {FAQS.map((item) => (
          <details key={item.q} className="group px-5 [&_summary]:list-none">
            <summary className="flex cursor-pointer items-center justify-between gap-4 py-4 font-medium">
              {item.q}
              <ChevronDown
                className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </p>
          </details>
        ))}
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { getContent } from "@/lib/content";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers to common questions from donors and campaign owners.",
};

export default async function FaqPage() {
  const { items } = await getContent("support.faq");

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Help"
        title="Frequently asked questions"
        description="Can't find what you're looking for? Reach us on the contact page."
      />

      <div className="divide-y rounded-lg border">
        {items.map((item) => (
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

import type { Metadata } from "next";
import { Mail, Phone, MapPin } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { MessageForm } from "@/components/support/message-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Get in touch with the Yewogen Derash support team.",
};

const CHANNELS = [
  { icon: Mail, label: "Email", value: "support@yewogenderash.com" },
  { icon: Phone, label: "Phone", value: "+251 900 000 000" },
  { icon: MapPin, label: "Office", value: "Addis Ababa, Ethiopia" },
] as const;

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Support"
        title="Contact us"
        description="Questions about a campaign, a donation, or becoming a verified owner? We're here to help."
      />

      <div className="grid gap-10 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-1">
          {CHANNELS.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-accent text-accent-foreground">
                <c.icon className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {c.label}
                </p>
                <p className="font-medium">{c.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-6 shadow-sm">
            <MessageForm variant="contact" />
          </div>
        </div>
      </div>
    </div>
  );
}

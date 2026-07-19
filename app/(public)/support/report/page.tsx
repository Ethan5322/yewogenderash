import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/site/page-header";
import { MessageForm } from "@/components/support/message-form";

export const metadata: Metadata = {
  title: "Report a campaign",
  description:
    "Report a campaign or owner you believe is fraudulent or misleading on Yewogen Derash.",
};

export default function ReportPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Trust & safety"
        title="Report a campaign"
        description="Help us keep Yewogen Derash safe. If something looks wrong, tell us — every report is reviewed."
      />

      <div className="mb-6 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4 text-sm">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
        <p>
          Reports are confidential. If you believe a crime is in progress, please
          also contact local authorities.
        </p>
      </div>

      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <MessageForm variant="report" />
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Fees & payouts",
  description:
    "Transparent hosting and platform fees, and how and when campaign funds are paid out on Yewogen Derash.",
};

export default function FeesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Fees & payouts"
        title="Clear fees. Audited payouts."
        description="We believe donors and owners deserve to know exactly what happens to every birr. Nothing is hidden."
      />
      <Prose>
        <h2>Platform fee</h2>
        <p>
          Yewogen Derash charges a transparent platform fee on funds raised. The
          fee covers identity verification, fraud monitoring, payment processing,
          and ongoing platform operation. The exact percentage is shown to
          campaign owners before they accept the fee policy during onboarding.
        </p>

        <h2>Payment processing</h2>
        <p>
          Donations are processed through our payment gateway. Gateway processing
          charges may apply per transaction and are disclosed at checkout. A
          donation is only counted once the gateway confirms it via a verified
          webhook — never before.
        </p>

        <h2>How payouts work</h2>
        <ul>
          <li>Each campaign has its own separated ledger. Funds are never pooled.</li>
          <li>
            Owners request a payout; every payout is reviewed and approved by an
            administrator before funds are released.
          </li>
          <li>
            New owners may have manual payout approval on their first campaigns as
            an anti-fraud safeguard.
          </li>
          <li>
            Every payout is recorded with a reference and an audit log entry.
          </li>
        </ul>

        <h2>Refunds</h2>
        <p>
          Refund eligibility depends on the campaign status and payment method.
          Disputed or fraudulent donations may be refunded or held pending review.
          See our <a href="/support/terms">Terms &amp; conditions</a> for details.
        </p>
      </Prose>
    </div>
  );
}

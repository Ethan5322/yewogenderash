import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Terms & conditions",
  description: "The terms that govern use of the Yewogen Derash platform.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader eyebrow="Legal" title="Terms & conditions" />
      <p className="mb-6 text-sm text-muted-foreground">
        These terms are a working draft and will be finalised before public
        launch. They describe the intended rules of the platform.
      </p>
      <Prose>
        <h2>1. Acceptance</h2>
        <p>
          By using Yewogen Derash, you agree to these terms. Campaign owners must
          explicitly accept these terms during onboarding before creating a
          campaign.
        </p>

        <h2>2. Eligibility & verification</h2>
        <p>
          Campaign owners must complete identity verification — including ID
          document upload and live face capture — and pass administrator review
          before any campaign is published. Unverified users may not run live
          campaigns.
        </p>

        <h2>3. Campaign conduct</h2>
        <ul>
          <li>Campaign information must be accurate and not misleading.</li>
          <li>Supporting documents must be genuine and relevant to the cause.</li>
          <li>Duplicate or deceptive campaigns are prohibited.</li>
        </ul>

        <h2>4. Funds & payouts</h2>
        <p>
          Funds for each campaign are held in a separated ledger and released only
          after administrator-approved payout. Owners may not self-release funds.
          See <a href="/support/fees">Fees &amp; payouts</a>.
        </p>

        <h2>5. Prohibited use</h2>
        <p>
          Fraud, money laundering, and any illegal fundraising are strictly
          prohibited and will be reported to the relevant authorities.
        </p>

        <h2>6. Liability</h2>
        <p>
          Yewogen Derash provides verification and safeguards but does not
          guarantee campaign outcomes. Donations are made at the donor&apos;s
          discretion.
        </p>
      </Prose>
    </div>
  );
}

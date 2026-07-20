import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Yewogen Derash collects, uses, and protects your personal and biometric data.",
};

const LAST_UPDATED = "20 July 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader eyebrow="Legal" title="Privacy policy" />
      <p className="mb-8 text-sm text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>
      <Prose>
        <p>
          This policy explains what personal data Yewogen Derash collects, why we
          collect it, and the choices you have. We collect only what we need to
          verify identities, process donations and payouts, and keep the Platform
          safe.
        </p>

        <h2>1. Data we collect</h2>
        <ul>
          <li>
            <strong>Account details</strong> — name, email, and phone number.
          </li>
          <li>
            <strong>Verification data</strong> — government identity documents
            and a live face capture, for campaign owners only.
          </li>
          <li>
            <strong>Payout details</strong> — bank or transfer information,
            accessible only to authorised administrators.
          </li>
          <li>
            <strong>Transaction records</strong> — donations and payouts
            associated with the relevant campaign.
          </li>
          <li>
            <strong>Technical data</strong> — limited log data such as IP address
            for security, fraud prevention, and audit purposes.
          </li>
        </ul>

        <h2>2. Biometric data &amp; consent</h2>
        <p>
          A live face capture is used solely to verify a campaign owner&apos;s
          identity against their submitted documents. It is collected only with
          explicit consent recorded during onboarding, stored securely in a
          private, access-controlled location, and is never used for advertising
          or sold to third parties.
        </p>

        <h2>3. How we use your data</h2>
        <ul>
          <li>To verify identities and prevent fraud and abuse.</li>
          <li>To process donations and administer payouts.</li>
          <li>To send transaction and campaign notifications you opt into.</li>
          <li>To maintain security, audit trails, and legal compliance.</li>
        </ul>

        <h2>4. Service providers</h2>
        <p>
          We share data only with the processors needed to run the Platform,
          under their respective terms: our database and file storage provider
          (Supabase), our payment gateway (Chapa) to process donations, and a
          messaging provider to deliver notifications you opt into. We do not sell
          your personal data.
        </p>

        <h2>5. Data retention</h2>
        <p>
          We keep personal and transaction data for as long as your account is
          active and as required to meet legal, accounting, and fraud-prevention
          obligations. Verification documents are retained only as long as needed
          to support the integrity of the campaigns they relate to.
        </p>

        <h2>6. Storage &amp; security</h2>
        <p>
          Identity documents are stored in a private, access-controlled bucket
          and are never exposed through public URLs. Access is limited to
          authorised administrators and is logged. Sensitive credentials are held
          server-side only.
        </p>

        <h2>7. Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          data, and may withdraw consent for optional processing such as
          notifications, subject to legal record-keeping requirements. To make a
          request, use our <a href="/support/contact">contact page</a>.
        </p>

        <h2>8. Children</h2>
        <p>
          The Platform is not directed to individuals under 18, and we do not
          knowingly collect their personal data.
        </p>

        <h2>9. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. Material changes will be
          reflected by an updated &ldquo;Last updated&rdquo; date above.
        </p>

        <h2>10. Contact</h2>
        <p>
          For any privacy question or request, reach us through our{" "}
          <a href="/support/contact">contact page</a>.
        </p>
      </Prose>
    </div>
  );
}

import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "How Yewogen Derash collects, uses, and protects your personal and biometric data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader eyebrow="Legal" title="Privacy policy" />
      <p className="mb-6 text-sm text-muted-foreground">
        This policy is a working draft and will be finalised before public launch.
      </p>
      <Prose>
        <h2>Data we collect</h2>
        <ul>
          <li>Account details: name, email, and phone number.</li>
          <li>
            Verification data: identity documents and a live face capture, for
            campaign owners only.
          </li>
          <li>Payout details, kept accessible only to authorised administrators.</li>
          <li>Donation records associated with the relevant campaign.</li>
        </ul>

        <h2>Biometric data consent</h2>
        <p>
          Face capture is used solely to verify a campaign owner&apos;s identity
          against their submitted documents. It is collected only with explicit
          consent, stored securely, and never shared for advertising or resold.
        </p>

        <h2>How we use your data</h2>
        <ul>
          <li>To verify identities and prevent fraud.</li>
          <li>To process donations and payouts.</li>
          <li>To send transaction and campaign notifications you opt into.</li>
        </ul>

        <h2>Storage & security</h2>
        <p>
          Identity documents are stored in a private, access-controlled bucket and
          are never exposed via public URLs. Access is limited to authorised
          administrators and logged.
        </p>

        <h2>Your rights</h2>
        <p>
          You may request access to, correction of, or deletion of your personal
          data, subject to legal record-keeping requirements. Contact us via the{" "}
          <a href="/support/contact">contact page</a>.
        </p>
      </Prose>
    </div>
  );
}

import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";
import { pageMeta } from "@/lib/seo";
import { PLATFORM_FEE_RATE, WITHHOLDING_FEE_RATE } from "@/lib/fees";

export const metadata: Metadata = pageMeta({
  title: "Terms & conditions",
  description:
    "The terms that govern use of the Yewogen Derash platform.",
  path: "/support/terms",
});

const LAST_UPDATED = "27 July 2026";

// Rates come from the fee module so the Terms can never state a percentage the
// code does not actually charge.
const feePct = Math.round(PLATFORM_FEE_RATE * 100);
const holdPct = Math.round(WITHHOLDING_FEE_RATE * 100);
const creditedPct = 100 - feePct;
const receivesPct = 100 - feePct - holdPct;

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader eyebrow="Legal" title="Terms & conditions" />
      <p className="mb-8 text-sm text-muted-foreground">
        Last updated: {LAST_UPDATED}
      </p>
      <Prose>
        <p>
          These Terms &amp; Conditions (the &ldquo;Terms&rdquo;) govern your
          access to and use of Yewogen Derash (the &ldquo;Platform&rdquo;), a
          trust-first crowdfunding service operated for donors and campaign
          owners worldwide. By creating an account, donating, or running a
          campaign, you agree to these Terms. If you do not agree, please do not
          use the Platform.
        </p>

        <h2>1. Definitions</h2>
        <ul>
          <li>
            <strong>Owner</strong> — a verified user who creates and manages a
            campaign.
          </li>
          <li>
            <strong>Donor</strong> — a user who contributes funds to a campaign.
          </li>
          <li>
            <strong>Campaign</strong> — a single fundraising effort with its own
            querycode, QR code, and separated ledger.
          </li>
          <li>
            <strong>We / us</strong> — the operator of Yewogen Derash.
          </li>
        </ul>

        <h2>2. Eligibility &amp; verification</h2>
        <p>
          You must be at least 18 years old and able to enter a binding
          agreement. Campaign owners must complete identity verification —
          including government ID upload and a live face capture — and pass
          administrator review before any campaign is published. We may decline,
          suspend, or revoke verification at our discretion where we cannot
          confirm identity or suspect misuse.
        </p>

        <h2>3. Accounts</h2>
        <p>
          You are responsible for the accuracy of your account information and
          for keeping your credentials secure. You are responsible for all
          activity under your account. Notify us promptly of any unauthorised
          use.
        </p>

        <h2>4. Campaign conduct</h2>
        <ul>
          <li>Campaign information must be accurate, current, and not misleading.</li>
          <li>Supporting documents must be genuine and relevant to the stated cause.</li>
          <li>Funds must be used for the purpose described to donors.</li>
          <li>Duplicate, deceptive, or impersonating campaigns are prohibited.</li>
        </ul>

        <h2>5. Donations</h2>
        <p>
          Donations are voluntary and are directed to exactly one campaign,
          resolved by that campaign&apos;s unique querycode. A donation is
          recorded only after the payment gateway confirms it through a verified
          webhook. Donations are generally non-refundable except as set out in
          our{" "}
          <a href="/support/fees">Fees &amp; payouts</a> policy or where required
          by law.
        </p>

        <h2>6. Fees &amp; payouts</h2>
        <p>
          Each campaign&apos;s funds are held in a separated ledger and are never
          pooled. Payouts are released only after administrator approval; owners
          cannot self-release funds.
        </p>
        <p>
          <strong>
            Two deductions apply, and they are the only deductions the Platform
            makes.
          </strong>{" "}
          Both are set out in full in our{" "}
          <a href="/support/fees">Fees &amp; payouts</a> policy and are shown to
          you in the Platform before you act:
        </p>
        <ol>
          <li>
            <strong>
              Transaction fee — {feePct}% of every donation, deducted from each
              donation at the time it is paid.
            </strong>{" "}
            This is charged on the gross amount the donor pays and covers payment
            processing, identity verification and fraud screening. The balance
            shown to a campaign owner is therefore always net of this fee — it is{" "}
            {creditedPct}% of what donors gave. Donors are shown this fee before
            they confirm a donation.
          </li>
          <li>
            <strong>
              Safety &amp; guarantee withholding — {holdPct}% of the total gross
              amount donated to a campaign, deducted when funds are withdrawn.
            </strong>{" "}
            This withholding is charged <strong>once per campaign</strong>, not on
            each withdrawal: where a campaign owner withdraws in instalments, any
            amount not yet collected is carried to the next withdrawal until the
            full {holdPct}% has been charged. It is deducted from the amount being
            withdrawn, and the exact figure is disclosed on the withdrawal request
            before the owner submits it. This withholding funds donor protection,
            including refunds where fraud is established and the guarantee that
            stands behind every verified campaign.{" "}
            <strong>
              It is retained by the Platform and is not refundable or returnable
              to the campaign owner.
            </strong>
          </li>
        </ol>
        <p>
          Taken together, a campaign owner receives{" "}
          <strong>{receivesPct}% of the gross amount donated</strong> to their
          campaign. The Platform retains {feePct + holdPct}% in total. No other
          charge is applied to a campaign owner by the Platform. Fees are stated
          exclusive of any charge your own bank may levy to receive a transfer.
        </p>
        <p>
          The Platform may change these rates. Any change is published on the{" "}
          <a href="/support/fees">Fees &amp; payouts</a> page before it takes
          effect and applies only to donations and withdrawals made after that
          date; it never changes the rate applied to money already received.
        </p>

        <h2>7. Prohibited activities</h2>
        <p>
          You may not use the Platform for fraud, money laundering, financing of
          illegal activity, or any purpose prohibited by applicable law. Such
          activity may be reported to the relevant authorities and will result in
          suspension and forfeiture of access.
        </p>

        <h2>8. Intellectual property &amp; your content</h2>
        <p>
          You retain ownership of the content you submit, and grant us a licence
          to host and display it as needed to operate the Platform. You must hold
          the rights to any content you upload. The Yewogen Derash name, brand,
          and software remain our property.
        </p>

        <h2>9. Suspension &amp; termination</h2>
        <p>
          We may suspend or terminate access, and withhold or reverse payouts,
          where we reasonably believe these Terms have been breached or where
          required to protect donors, owners, or the integrity of the Platform.
        </p>

        <h2>10. Disclaimers &amp; limitation of liability</h2>
        <p>
          We provide verification and safeguards but do not guarantee campaign
          outcomes or the conduct of any user. The Platform is provided on an
          &ldquo;as is&rdquo; basis. To the fullest extent permitted by law, we
          are not liable for indirect or consequential losses arising from your
          use of the Platform. Nothing in these Terms limits liability that
          cannot be limited under applicable law.
        </p>

        <h2>11. Changes to these Terms</h2>
        <p>
          We may update these Terms from time to time. Material changes will be
          reflected by an updated &ldquo;Last updated&rdquo; date, and continued
          use of the Platform constitutes acceptance of the revised Terms.
        </p>

        <h2>12. Governing law</h2>
        <p>
          These Terms are governed by the laws of the Federal Democratic Republic
          of Ethiopia, and disputes are subject to the courts of Addis Ababa.
        </p>

        <h2>13. Contact</h2>
        <p>
          Questions about these Terms can be sent through our{" "}
          <a href="/support/contact">contact page</a>.
        </p>
      </Prose>
    </div>
  );
}

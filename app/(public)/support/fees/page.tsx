import type { Metadata } from "next";
import { PageHeader, Prose } from "@/components/site/page-header";
import { pageMeta } from "@/lib/seo";
import { PLATFORM_FEE_RATE, WITHHOLDING_FEE_RATE } from "@/lib/fees";

export const metadata: Metadata = pageMeta({
  title: "Fees & payouts",
  description:
    "Transparent hosting and platform fees, and how and when campaign funds are paid out on Yewogen Derash.",
  path: "/support/fees",
});

// Straight from the fee module, so this page always states what is charged.
const feePct = Math.round(PLATFORM_FEE_RATE * 100);
const holdPct = Math.round(WITHHOLDING_FEE_RATE * 100);
const creditedPct = 100 - feePct;
const receivesPct = 100 - feePct - holdPct;

export default function FeesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <PageHeader
        eyebrow="Fees & payouts"
        title="Clear fees. Audited payouts."
        description="We believe donors and owners deserve to know exactly what happens to every birr. Nothing is hidden."
      />
      <Prose>
        <h2>The short version</h2>
        <p>
          There are exactly two deductions. On every{" "}
          <strong>ETB 100</strong> donated:
        </p>
        <ul>
          <li>
            <strong>ETB {feePct} — transaction fee</strong>, taken from the
            donation when it is paid.
          </li>
          <li>
            <strong>ETB {creditedPct} is credited to the campaign</strong> — this
            is the balance a campaign owner sees.
          </li>
          <li>
            <strong>ETB {holdPct} — safety &amp; guarantee withholding</strong>,
            taken once per campaign when funds are withdrawn.
          </li>
          <li>
            <strong>ETB {receivesPct} reaches the campaign owner.</strong>
          </li>
        </ul>

        <h2>1. Transaction fee — {feePct}% of every donation</h2>
        <p>
          Charged on the gross amount each donor pays, at the moment the donation
          is confirmed. It covers payment processing, identity verification, fraud
          monitoring and running the platform. Donors see this fee before they
          confirm a donation.
        </p>
        <p>
          Because it is taken at payment time, the balance a campaign owner sees
          is <strong>always already net of it</strong> — {creditedPct}% of what
          donors gave. Every donation, its fee and the amount credited are listed
          line by line in the owner&apos;s transaction statement.
        </p>

        <h2>2. Safety &amp; guarantee withholding — {holdPct}% of funds raised</h2>
        <p>
          Deducted when a campaign owner withdraws, and charged{" "}
          <strong>once per campaign</strong> — not on every withdrawal. It is
          calculated on the total gross donated to that campaign. If an owner
          withdraws in instalments, whatever has not yet been collected carries to
          the next withdrawal until the full {holdPct}% has been charged.
        </p>
        <p>
          The exact amount is shown on the withdrawal request, before the owner
          submits it, together with the figure they will actually receive.
        </p>
        <p>
          This withholding is what makes the guarantee behind a verified campaign
          real: it funds refunds where fraud is established, and the donor
          protection that sits behind every campaign we publish. It is retained by
          the platform and is not returned to the campaign owner.
        </p>
        <p>
          <strong>
            In total a campaign owner receives {receivesPct}% of what was donated
            to their campaign, and the platform retains {feePct + holdPct}%.
          </strong>{" "}
          We charge campaign owners nothing else. Your own bank may charge you to
          receive a transfer; that is outside our control.
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
            Requesting a withdrawal sends a transfer report to the administrators
            automatically — the owner does not have to chase anyone.
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

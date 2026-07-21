import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { signedKycUrl } from "@/lib/supabase/server";
import { OwnerDecisionPanel } from "@/components/admin/owner-decision-panel";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Admin · Owner review" };

export default async function AdminOwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("kyc");
  const { id } = await params;

  const owner = await db.campaignOwner.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          name: true,
          email: true,
          phone: true,
          emailVerifiedAt: true,
          phoneVerifiedAt: true,
          verificationStatus: true,
          isBanned: true,
          createdAt: true,
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
      campaigns: {
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, status: true },
      },
    },
  });
  if (!owner) notFound();

  const docs = await Promise.all(
    owner.documents.map(async (d) => ({
      ...d,
      signedUrl: await signedKycUrl(d.fileUrl, 600),
    }))
  );

  const payout = owner.payoutAccount as {
    accountType?: string;
    accountName?: string;
    accountNumber?: string;
    bankName?: string | null;
  } | null;

  return (
    <div>
      <Link
        href="/admin/owners"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Owner KYC queue
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {owner.user.name}
        </h1>
        {owner.mulesooVerified ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
            Mulesoo verified
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        KYC status <span className="font-medium">{owner.user.verificationStatus}</span> ·
        member since {formatDate(owner.user.createdAt)}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Identity & contact */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">Identity & contact</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd className="font-medium">
                  {owner.user.email}{" "}
                  <span className="text-xs text-muted-foreground">
                    {owner.user.emailVerifiedAt ? "(verified)" : "(unverified)"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd className="font-medium">
                  {owner.user.phone ?? "—"}{" "}
                  <span className="text-xs text-muted-foreground">
                    {owner.user.phoneVerifiedAt ? "(verified)" : "(unverified)"}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">ID number</dt>
                <dd className="font-mono">{owner.idNumber ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Biometric</dt>
                <dd>{owner.biometricStatus}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Face match (live vs ID)</dt>
                <dd>
                  {owner.faceMatchScore == null ? (
                    <span className="text-muted-foreground">not computed</span>
                  ) : owner.faceMatchScore < 0.6 ? (
                    <span className="font-medium text-success">
                      ✓ Same person · {owner.faceMatchScore.toFixed(3)}
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">
                      ✗ No match · {owner.faceMatchScore.toFixed(3)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Author code</dt>
                <dd className="font-mono">{owner.authorCode ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Consents</dt>
                <dd className="text-xs">
                  Terms {owner.termsAcceptedAt ? formatDate(owner.termsAcceptedAt) : "—"} ·
                  Fees {owner.feesAcceptedAt ? formatDate(owner.feesAcceptedAt) : "—"} ·
                  Biometric{" "}
                  {owner.biometricConsentAt ? formatDate(owner.biometricConsentAt) : "—"}
                </dd>
              </div>
            </dl>
            {payout ? (
              <div className="mt-4 border-t pt-4 text-sm">
                <h3 className="font-medium">Payout account (admin-only)</h3>
                <p className="mt-1 text-muted-foreground">
                  {payout.accountType === "TELEBIRR" ? "Telebirr" : "Bank"} ·{" "}
                  {payout.accountName} · {payout.accountNumber}
                  {payout.bankName ? ` · ${payout.bankName}` : ""}
                </p>
              </div>
            ) : null}
          </section>

          {/* Documents */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">
              Documents ({docs.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Signed links expire in 10 minutes.
            </p>
            {docs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">No documents.</p>
            ) : (
              <ul className="mt-4 divide-y">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {d.documentType.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(d.createdAt)} · {d.status}
                          {d.adminNote ? ` · note: ${d.adminNote}` : ""}
                        </p>
                      </div>
                    </div>
                    {d.signedUrl ? (
                      <a
                        href={d.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-primary hover:underline"
                      >
                        Open <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                      </a>
                    ) : (
                      <span className="text-xs text-muted-foreground">unavailable</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Issued Fundraiser ID (verified owners) */}
          {owner.mulesooVerified && owner.authorCode ? (
            <section className="rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="mb-4 font-display text-base font-semibold">
                Fundraiser ID
              </h2>
              <FundraiserIdCard
                name={owner.user.name}
                verificationCode={owner.authorCode ?? "—"}
                issued={owner.verifiedAt ? formatDate(owner.verifiedAt) : "—"}
                status={owner.mulesooVerified ? "VERIFIED" : "PENDING REVIEW"}
                photoUrl={owner.idPhotoUrl}
                approved={owner.mulesooVerified}
                fields={[
                  { label: "Status", value: owner.mulesooVerified ? "Verified" : "Pending" },
                  { label: "Platform", value: "Yewogen Derash" },
                ]}
              />
              <p className="mt-3 text-xs text-muted-foreground">
                Scan the QR to open this owner's verification profile with the
                biometric capture.
              </p>
            </section>
          ) : null}

          {/* Decision */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">KYC decision</h2>
            {owner.user.verificationStatus === "PENDING" ? (
              <div className="mt-4">
                <OwnerDecisionPanel ownerId={owner.id} />
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                No application awaiting review
                {owner.user.verificationStatus === "VERIFIED"
                  ? " — this owner is verified."
                  : ` (status: ${owner.user.verificationStatus}).`}
              </p>
            )}
          </section>

          {/* Campaigns */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">
              Campaigns ({owner.campaigns.length})
            </h2>
            {owner.campaigns.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">None yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {owner.campaigns.map((c) => (
                  <li key={c.id} className="flex items-center justify-between gap-2 text-sm">
                    <Link
                      href={`/admin/campaigns/${c.id}`}
                      className="min-w-0 truncate font-medium hover:text-primary hover:underline"
                    >
                      {c.title}
                    </Link>
                    <StatusBadge status={c.status} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

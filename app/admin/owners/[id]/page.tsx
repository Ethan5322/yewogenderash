import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission, hasPermission } from "@/lib/admin/permissions";
import { signedKycUrl } from "@/lib/supabase/server";
import { OwnerDecisionPanel } from "@/components/admin/owner-decision-panel";
import { FlagControl } from "@/components/admin/flag-control";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { DocumentPreview, type DocKind } from "@/components/admin/document-preview";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Admin · Owner review" };

function docKind(ext: string): DocKind {
  if (["jpg", "jpeg", "png", "webp", "gif", "heic"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  return "other";
}

export default async function AdminOwnerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requirePermission("kyc");
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
      payoutAccounts: {
        where: { isDefault: true, isVerified: true },
        take: 1,
        select: { accountName: true, accountNumber: true, bankName: true },
      },
    },
  });
  if (!owner) notFound();

  const safeName = owner.user.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const docs = await Promise.all(
    owner.documents.map(async (d) => {
      const ext = (d.fileUrl.split(".").pop()?.split("?")[0] || "file").toLowerCase();
      const kind = docKind(ext);
      const filename = `${safeName}-${d.documentType.toLowerCase()}.${ext}`;
      const [signedUrl, downloadUrl] = await Promise.all([
        signedKycUrl(d.fileUrl, 600),
        signedKycUrl(d.fileUrl, 600, filename),
      ]);
      return { ...d, signedUrl, downloadUrl, kind };
    })
  );

  const payout = owner.payoutAccounts[0] ?? null;

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
        {hasPermission(me, "messages") ? (
          <Link
            href={`/admin/messages/${owner.id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
          >
            <MessageSquare className="h-4 w-4" aria-hidden /> Message fundraiser
          </Link>
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
                <dt className="text-muted-foreground">Liveness check</dt>
                <dd>
                  {owner.livenessPassed ? (
                    <span className="font-medium text-success">✓ Passed (live)</span>
                  ) : (
                    <span className="text-warning">Not confirmed (uploaded / manual)</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Face match (live vs ID)</dt>
                <dd>
                  {owner.faceMatched == null ? (
                    <span className="text-muted-foreground">not computed</span>
                  ) : owner.faceMatched ? (
                    <span className="font-medium text-success">
                      ✓ Same person
                      {owner.faceMatchScore != null ? ` · ${owner.faceMatchScore.toFixed(3)}` : ""}
                      {owner.faceEngine ? ` · ${owner.faceEngine}` : ""}
                    </span>
                  ) : (
                    <span className="font-medium text-destructive">
                      ✗ No match
                      {owner.faceMatchScore != null ? ` · ${owner.faceMatchScore.toFixed(3)}` : ""}
                      {owner.faceEngine ? ` · ${owner.faceEngine}` : ""}
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
                  {payout.bankName} · {payout.accountName} · {payout.accountNumber}
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
                  <DocumentPreview
                    key={d.id}
                    label={d.documentType.replaceAll("_", " ") + (d.adminNote ? ` · note: ${d.adminNote}` : "")}
                    status={d.status}
                    uploaded={formatDate(d.createdAt)}
                    kind={d.kind}
                    signedUrl={d.signedUrl}
                    downloadUrl={d.downloadUrl}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="space-y-6">
          {/* Decision — the allow / disallow switch, first and prominent */}
          <section className="overflow-hidden rounded-xl border-2 border-primary/30 bg-card shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b bg-primary/5 px-6 py-3">
              <h2 className="font-display text-base font-semibold text-primary">
                Allow / Disallow this fundraiser
              </h2>
              <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold">
                {owner.user.verificationStatus}
              </span>
            </div>
            <div className="p-6">
              <p className="mb-4 text-xs text-muted-foreground">
                <strong>Allow</strong> grants the Mulesoo seal, issues the author
                code, and unlocks the Fundraiser ID. <strong>Reject / Revoke</strong>{" "}
                denies or withdraws it. A note is required for anything but Allow.
              </p>
              <OwnerDecisionPanel
                ownerId={owner.id}
                status={owner.user.verificationStatus}
              />
            </div>
          </section>

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

          {/* Fraud flag */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="mb-3 font-display text-base font-semibold">Fraud flag</h2>
            <FlagControl
              kind="owner"
              id={owner.id}
              flagged={owner.flagged}
              reason={owner.flagReason}
            />
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

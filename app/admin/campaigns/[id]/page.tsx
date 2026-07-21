import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, FileText, ShieldCheck, Star } from "lucide-react";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/admin/permissions";
import { signedKycUrl } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { CampaignDecisionPanel } from "@/components/admin/campaign-decision-panel";
import { FlagControl } from "@/components/admin/flag-control";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { formatETB, formatDate } from "@/lib/format";

export const metadata = { title: "Admin · Campaign review" };

export default async function AdminCampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePermission("campaigns");
  const { id } = await params;

  const campaign = await db.campaign.findUnique({
    where: { id },
    include: {
      owner: {
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
            },
          },
          documents: { orderBy: { createdAt: "desc" } },
        },
      },
      documents: { orderBy: { createdAt: "desc" } },
      _count: { select: { donations: { where: { status: "SUCCESS" } } } },
      donations: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          donorName: true,
          txRef: true,
          paidAt: true,
          createdAt: true,
        },
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          amount: true,
          currency: true,
          status: true,
          payoutReference: true,
          createdAt: true,
        },
      },
    },
  });
  if (!campaign) notFound();

  const owner = campaign.owner;

  // Fee split totals for this campaign's separated ledger (§12.4).
  const feeAgg = await db.feeLedger.aggregate({
    where: { campaignId: id },
    _sum: { grossAmount: true, feeAmount: true, netAmount: true },
  });
  const gross = Number(feeAgg._sum.grossAmount ?? 0);
  const fees = Number(feeAgg._sum.feeAmount ?? 0);
  const net = Number(feeAgg._sum.netAmount ?? 0);

  // Short-lived signed URLs so the reviewer can open each private document.
  const docs = await Promise.all(
    owner.documents.map(async (d) => ({
      ...d,
      signedUrl: await signedKycUrl(d.fileUrl, 600),
    }))
  );
  const campaignDocs = await Promise.all(
    campaign.documents.map(async (d) => ({
      ...d,
      signedUrl: await signedKycUrl(d.fileUrl, 600),
    }))
  );

  return (
    <div>
      <Link
        href="/admin/campaigns"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        All campaigns
      </Link>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          {campaign.title}
        </h1>
        <StatusBadge status={campaign.status} />
        {campaign.isFeatured ? (
          <Badge variant="gold">
            <Star className="h-3.5 w-3.5" aria-hidden /> Featured
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {CATEGORY_LABELS[campaign.category]} · querycode{" "}
        <span className="font-mono">{campaign.queryCode}</span> · created{" "}
        {formatDate(campaign.createdAt)}
        {campaign.status === "ACTIVE" || campaign.status === "COMPLETED" ? (
          <>
            {" · "}
            <Link
              href={`/campaigns/${campaign.slug}`}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              public page <ExternalLink className="h-3 w-3" aria-hidden />
            </Link>
          </>
        ) : null}
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Campaign content */}
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">Campaign details</h2>
            <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Target</dt>
                <dd className="font-semibold">
                  {formatETB(Number(campaign.targetAmount), campaign.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Raised (confirmed)</dt>
                <dd className="font-semibold">
                  {formatETB(Number(campaign.currentAmount), campaign.currency)} ·{" "}
                  {campaign._count.donations} donations
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd>{campaign.location ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">End date</dt>
                <dd>{campaign.endDate ? formatDate(campaign.endDate) : "Open-ended"}</dd>
              </div>
            </dl>
            <div className="mt-4 border-t pt-4">
              <h3 className="text-sm font-medium">Summary</h3>
              <p className="mt-1 text-sm text-foreground/85">{campaign.description}</p>
            </div>
            {campaign.story ? (
              <div className="mt-4 border-t pt-4">
                <h3 className="text-sm font-medium">Full story</h3>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/85">
                  {campaign.story}
                </p>
              </div>
            ) : null}
          </section>

          {/* Per-campaign proof (category-matched evidence for THIS campaign) */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">
              Campaign proof documents ({campaignDocs.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Evidence attached to this specific campaign. Verify it matches the
              category and story before approving. Links expire in 10 minutes.
            </p>
            {campaignDocs.length === 0 ? (
              <p className="mt-4 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
                No proof document on this campaign. Treat with caution — newer
                campaigns require a category-matched proof at creation.
              </p>
            ) : (
              <ul className="mt-4 divide-y">
                {campaignDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      <div className="min-w-0">
                        <p className="text-sm font-medium">
                          {d.documentType.replaceAll("_", " ")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Uploaded {formatDate(d.createdAt)} · status {d.status}
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

          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">
              Owner documents ({docs.length})
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Links are signed and expire in 10 minutes. Access is logged.
            </p>
            {docs.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                No documents on file.
              </p>
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
                          Uploaded {formatDate(d.createdAt)} · status {d.status}
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
          {/* Donation ledger (per-campaign, §12.4) */}
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">Financial summary</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Gross raised</p>
                <p className="mt-1 font-display text-lg font-bold">
                  {formatETB(gross, campaign.currency)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Platform fees (3%)</p>
                <p className="mt-1 font-display text-lg font-bold text-warning">
                  {formatETB(fees, campaign.currency)}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/30 p-4">
                <p className="text-xs text-muted-foreground">Net to campaign</p>
                <p className="mt-1 font-display text-lg font-bold text-success">
                  {formatETB(net, campaign.currency)}
                </p>
              </div>
            </div>

            <h2 className="mt-6 border-t pt-4 font-display text-base font-semibold">
              Donation ledger (latest 20)
            </h2>
            {campaign.donations.length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No donations yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Date</th>
                      <th className="py-2 pr-3 font-medium">Donor</th>
                      <th className="py-2 pr-3 font-medium">Amount</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {campaign.donations.map((d) => (
                      <tr key={d.id} className="border-b last:border-0">
                        <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                          {formatDate(d.paidAt ?? d.createdAt)}
                        </td>
                        <td className="py-2 pr-3">{d.donorName ?? "Anonymous"}</td>
                        <td className="py-2 pr-3 whitespace-nowrap font-medium">
                          {formatETB(Number(d.amount), d.currency)}
                        </td>
                        <td className="py-2 pr-3 text-xs font-semibold">{d.status}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {d.txRef}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 className="mt-6 border-t pt-4 text-sm font-medium">
              Payout summary
            </h3>
            {campaign.payouts.length === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">No payouts recorded.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {campaign.payouts.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {formatDate(p.createdAt)}
                      {p.payoutReference ? ` · ${p.payoutReference}` : ""}
                    </span>
                    <span>
                      <span className="font-medium">
                        {formatETB(Number(p.amount), p.currency)}
                      </span>{" "}
                      <span className="text-xs font-semibold">{p.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Owner + decision */}
        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">Owner</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{owner.user.name}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Email</dt>
                <dd>{owner.user.email}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Phone</dt>
                <dd>{owner.user.phone ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">KYC status</dt>
                <dd>{owner.user.verificationStatus}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Biometric</dt>
                <dd>{owner.biometricStatus}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Author code</dt>
                <dd className="font-mono">{owner.authorCode ?? "—"}</dd>
              </div>
            </dl>
            {owner.mulesooVerified ? (
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-success/10 px-3 py-1 text-xs font-medium text-success">
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                Mulesoo verified
              </p>
            ) : null}
            {owner.user.isBanned ? (
              <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs font-medium text-destructive">
                This user is banned.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border bg-card p-6 shadow-sm">
            <h2 className="font-display text-base font-semibold">Decision</h2>
            {campaign.reviewNote ? (
              <p className="mt-2 rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
                Last note: {campaign.reviewNote}
                {campaign.reviewedAt ? ` (${formatDate(campaign.reviewedAt)})` : ""}
              </p>
            ) : null}
            <div className="mt-4">
              <CampaignDecisionPanel
                campaignId={campaign.id}
                status={campaign.status}
                isFeatured={campaign.isFeatured}
              />
            </div>
            <div className="mt-4 border-t pt-4">
              <FlagControl
                kind="campaign"
                id={campaign.id}
                flagged={campaign.flagged}
                reason={campaign.flagReason}
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

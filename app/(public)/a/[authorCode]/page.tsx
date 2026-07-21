import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BadgeCheck,
  ScanFace,
  Download,
  Megaphone,
  ExternalLink,
} from "lucide-react";
import { auth } from "@/auth";
import { getAuthorProfile } from "@/lib/authors";
import { signedKycUrl } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/campaigns/status-badge";
import { ProgressBar } from "@/components/campaigns/progress-bar";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { CATEGORY_LABELS } from "@/lib/campaign-types";
import { formatETB, formatDate, progressPercent } from "@/lib/format";

type Params = { params: Promise<{ authorCode: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { authorCode } = await params;
  const owner = await getAuthorProfile(authorCode);
  return {
    title: owner ? `${owner.user.name} · Verified owner` : "Author not found",
    robots: { index: false, follow: false },
  };
}

export default async function AuthorProfilePage({ params }: Params) {
  const { authorCode } = await params;
  const owner = await getAuthorProfile(authorCode);
  if (!owner || !owner.mulesooVerified) notFound();

  // Admins who scan the code see the private biometric capture + status.
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";
  const selfie = owner.documents[0];
  const selfieUrl = isAdmin && selfie ? await signedKycUrl(selfie.fileUrl, 600) : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Corporate Fundraiser ID card */}
      <div className="flex flex-col items-center gap-4">
        <FundraiserIdCard
          name={owner.user.name}
          authorCode={owner.authorCode ?? ""}
          verifiedAt={owner.verifiedAt}
          photoUrl={owner.idPhotoUrl}
          mulesooVerified={owner.mulesooVerified}
        />
        <a
          href={`/a/${owner.authorCode}/qr`}
          download={`fundraiser-${owner.authorCode}.png`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Download className="h-3 w-3" aria-hidden /> Download QR
        </a>
      </div>

      {/* Admin-only biometric verification panel */}
      {isAdmin ? (
        <div className="mt-8 overflow-hidden rounded-2xl border bg-card p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-2">
              <ScanFace className="h-4 w-4 text-primary" aria-hidden />
              <h2 className="font-display text-sm font-semibold">
                Biometric verification (admin only)
              </h2>
            </div>
            <div className="mt-4 flex flex-wrap items-start gap-6">
              <div className="relative">
                {selfieUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element -- signed private URL */}
                    <img
                      src={selfieUrl}
                      alt="Biometric face capture"
                      className="h-40 w-40 rounded-lg border object-cover"
                    />
                    {/* "Verified ink" watermark stamp over the capture */}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <span className="rotate-[-18deg] rounded border-2 border-success/70 px-2 py-0.5 text-[11px] font-bold uppercase tracking-widest text-success/80">
                        Mulesoo verified
                      </span>
                    </span>
                  </>
                ) : (
                  <div className="flex h-40 w-40 items-center justify-center rounded-lg border text-xs text-muted-foreground">
                    No capture on file
                  </div>
                )}
              </div>
              <dl className="grid gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Biometric status:</dt>
                  <dd className="font-medium">{owner.biometricStatus}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Capture status:</dt>
                  <dd className="font-medium">{selfie?.status ?? "—"}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted-foreground">Captured:</dt>
                  <dd>{selfie ? formatDate(selfie.createdAt) : "—"}</dd>
                </div>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  The signed link expires in 10 minutes. This panel is only shown
                  to signed-in administrators.
                </p>
              </dl>
            </div>
        </div>
      ) : null}

      {/* Owned campaigns */}
      <section className="mt-8">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Megaphone className="h-4 w-4 text-muted-foreground" aria-hidden />
          Campaigns by this owner
        </h2>
        {owner.campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No public campaigns yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {owner.campaigns.map((c) => {
              const pct = progressPercent(Number(c.currentAmount), Number(c.targetAmount));
              return (
                <li key={c.id} className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/campaigns/${c.slug}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {c.title}
                      </Link>
                      <StatusBadge status={c.status} />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {CATEGORY_LABELS[c.category]}
                    </span>
                  </div>
                  <div className="mt-3">
                    <ProgressBar value={pct} label={`${pct}% funded`} />
                    <div className="mt-1.5 flex items-baseline justify-between text-sm">
                      <span className="font-semibold">
                        {formatETB(Number(c.currentAmount), c.currency)}
                      </span>
                      <Link
                        href={`/campaigns/${c.slug}`}
                        className="inline-flex items-center gap-0.5 text-xs text-primary hover:underline"
                      >
                        View <ExternalLink className="h-3 w-3" aria-hidden />
                      </Link>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden />
        This owner passed identity verification and manual review by Yewogen
        Derash administrators.
      </div>
    </div>
  );
}

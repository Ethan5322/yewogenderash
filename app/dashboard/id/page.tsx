import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { IdPhotoUpload } from "@/components/owner/id-photo-upload";
import { formatDate } from "@/lib/format";

export const metadata = { title: "My Fundraiser ID" };

export default async function FundraiserIdPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/id");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: {
      authorCode: true,
      verifiedAt: true,
      mulesooVerified: true,
      idPhotoUrl: true,
      createdAt: true,
      user: { select: { name: true, verificationStatus: true } },
    },
  });

  if (!owner) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={session.user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Fundraiser ID</h1>
          <p className="mt-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Begin owner verification to be issued your Fundraiser ID.{" "}
            <Link href="/start" className="text-primary hover:underline">Get started</Link>.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const approved = owner.mulesooVerified && !!owner.authorCode;
  const code = owner.authorCode ?? "PENDING-REVIEW";
  const status = approved ? "VERIFIED" : "PENDING REVIEW";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          My Fundraiser ID
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your official verification card. It stays locked until an administrator
          approves your verification — then you can download it as an image or PDF.
        </p>

        {/* The card (masked until approved) */}
        <div className="mt-8 flex justify-center">
          <FundraiserIdCard
            name={owner.user.name}
            verificationCode={code}
            issued={owner.verifiedAt ? formatDate(owner.verifiedAt) : "—"}
            status={status}
            photoUrl={owner.idPhotoUrl}
            approved={approved}
            showDownload
            fields={[
              { label: "Status", value: approved ? "Verified" : "Pending" },
              { label: "Member since", value: formatDate(owner.createdAt) },
              { label: "Platform", value: "Yewogen Derash" },
            ]}
          />
        </div>

        {approved ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/a/${owner.authorCode}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" aria-hidden /> Public profile
            </Link>
          </div>
        ) : null}

        {/* Photo management */}
        <section className="mt-10 rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
            <h2 className="font-display text-base font-semibold">ID photo</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Upload a clear photo of your face from your gallery. It is
            auto-cropped and placed on your ID. This is separate from the private
            verification selfie only your reviewer sees.
          </p>
          <div className="mt-4">
            <IdPhotoUpload hasPhoto={!!owner.idPhotoUrl} />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

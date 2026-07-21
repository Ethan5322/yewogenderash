import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Download, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { FundraiserIdCard } from "@/components/owner/fundraiser-id-card";
import { IdPhotoUpload } from "@/components/owner/id-photo-upload";
import { PrintButton } from "@/components/owner/print-button";

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
      user: { select: { name: true } },
    },
  });

  // Only verified owners have an issued ID.
  if (!owner || !owner.mulesooVerified || !owner.authorCode) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={session.user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
          </Link>
          <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Fundraiser ID</h1>
          <p className="mt-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Your corporate Fundraiser ID is issued automatically once an
            administrator approves your verification.{" "}
            <Link href="/start" className="text-primary hover:underline">
              Complete verification
            </Link>{" "}
            to get yours.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

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
          Your official verification card. Anyone — including our admins — can
          scan the QR to confirm your identity on Yewogen Derash.
        </p>

        {/* The card */}
        <div className="mt-8 flex justify-center print:mt-0">
          <FundraiserIdCard
            name={owner.user.name}
            authorCode={owner.authorCode}
            verifiedAt={owner.verifiedAt}
            photoUrl={owner.idPhotoUrl}
            mulesooVerified={owner.mulesooVerified}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3 print:hidden">
          <PrintButton />
          <a
            href={`/a/${owner.authorCode}/qr`}
            download={`fundraiser-${owner.authorCode}.png`}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Download className="h-4 w-4" aria-hidden /> Download QR
          </a>
          <Link
            href={`/a/${owner.authorCode}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-input px-4 py-2 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Public profile
          </Link>
        </div>

        {/* Photo management */}
        <section className="mt-10 rounded-xl border bg-card p-6 shadow-sm print:hidden">
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

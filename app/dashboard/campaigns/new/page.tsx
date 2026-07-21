import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CampaignForm } from "@/components/campaigns/campaign-form";

export const metadata: Metadata = { title: "New campaign" };

export default async function NewCampaignPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/campaigns/new");

  // Verified owners only — mirrors the server action's own gate.
  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { verificationStatus: true, ownerProfile: { select: { id: true } } },
  });
  if (!user || user.verificationStatus !== "VERIFIED" || !user.ownerProfile) {
    redirect("/start");
  }

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard/campaigns"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          My campaigns
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Create a campaign
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Drafts are private. On submission, our reviewers verify the story
          against your documents before the campaign goes live with its own
          querycode and QR.
        </p>

        <div className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
          <CampaignForm requireProof />
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

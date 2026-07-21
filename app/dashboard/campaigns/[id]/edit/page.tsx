import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { CampaignForm } from "@/components/campaigns/campaign-form";
import { updateCampaignAction } from "@/app/dashboard/campaigns/actions";

export const metadata = { title: "Edit campaign" };

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/login?callbackUrl=/dashboard/campaigns/${id}/edit`);

  // Ownership scope: an owner can only edit their own campaign.
  const campaign = await db.campaign.findFirst({
    where: { id, owner: { userId: session.user.id } },
    select: {
      id: true,
      title: true,
      category: true,
      targetAmount: true,
      location: true,
      endDate: true,
      description: true,
      story: true,
      heroImageUrl: true,
      status: true,
    },
  });
  if (!campaign) notFound();

  const locked = campaign.status === "ARCHIVED" || campaign.status === "COMPLETED";

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href={`/dashboard/campaigns/${campaign.id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to campaign
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Edit campaign
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update your campaign details and image. Funds, status, and your
          querycode never change here — those stay with administrators.
        </p>

        {locked ? (
          <p className="mt-8 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            This campaign is {campaign.status.toLowerCase()} and can no longer be
            edited.
          </p>
        ) : (
          <div className="mt-8">
            <CampaignForm
              action={updateCampaignAction.bind(null, campaign.id)}
              submitLabel="Save changes"
              footerNote="Changes are saved immediately and recorded in the audit log."
              currentHeroUrl={campaign.heroImageUrl}
              defaults={{
                title: campaign.title,
                category: campaign.category,
                targetAmount: Number(campaign.targetAmount),
                location: campaign.location ?? "",
                endDate: campaign.endDate
                  ? campaign.endDate.toISOString().slice(0, 10)
                  : "",
                description: campaign.description,
                story: campaign.story ?? "",
              }}
            />
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

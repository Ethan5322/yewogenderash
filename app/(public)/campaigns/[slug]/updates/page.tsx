import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import { getCampaignUpdates } from "@/lib/campaigns";
import { formatDate } from "@/lib/format";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const campaign = await getCampaignUpdates(slug);
  return {
    title: campaign ? `Updates · ${campaign.title}` : "Campaign not found",
  };
}

export default async function CampaignUpdatesPage({ params }: Params) {
  const { slug } = await params;
  const campaign = await getCampaignUpdates(slug);
  if (!campaign) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        href={`/campaigns/${campaign.slug}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to campaign
      </Link>

      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">
        Updates
      </h1>
      <p className="mt-1 text-muted-foreground">{campaign.title}</p>

      {campaign.updates.length === 0 ? (
        <div className="mt-10 flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
          <Megaphone className="h-9 w-9 text-muted-foreground" aria-hidden />
          <p className="mt-3 font-medium">No updates yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            When the owner posts progress, it will appear here.
          </p>
        </div>
      ) : (
        <ol className="mt-8 space-y-6 border-l pl-6">
          {campaign.updates.map((u) => (
            <li key={u.id} className="relative">
              <span
                className="absolute -left-[1.65rem] top-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary"
                aria-hidden
              />
              <time className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {formatDate(u.createdAt)}
              </time>
              <h2 className="mt-1 font-display text-lg font-semibold">{u.title}</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-foreground/90">
                {u.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

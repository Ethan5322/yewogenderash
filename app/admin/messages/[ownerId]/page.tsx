import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldCheck, ExternalLink } from "lucide-react";
import { requirePermission } from "@/lib/admin/permissions";
import { getAdminThread } from "@/lib/messages";
import { MessageReplyForm } from "@/components/admin/message-reply-form";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Admin · Conversation" };

export default async function AdminThreadPage({
  params,
}: {
  params: Promise<{ ownerId: string }>;
}) {
  await requirePermission("messages");
  const { ownerId } = await params;
  const thread = await getAdminThread(ownerId);
  if (!thread) notFound();

  const { owner, messages } = thread;

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/admin/messages"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All messages
      </Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">{owner.user.name}</h1>
          <p className="text-sm text-muted-foreground">
            {owner.user.email}
            {owner.authorCode ? ` · ${owner.authorCode}` : ""}
          </p>
        </div>
        {owner.authorCode ? (
          <Link
            href={`/a/${owner.authorCode}`}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View ID <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </Link>
        ) : null}
      </div>

      <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages in this thread yet.</p>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={m.fromAdmin ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                    m.fromAdmin
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm bg-muted text-foreground"
                  }`}
                >
                  {m.fromAdmin ? (
                    <p className="mb-1 flex items-center gap-1 text-xs font-semibold opacity-80">
                      <ShieldCheck className="h-3 w-3" aria-hidden /> Admin team
                    </p>
                  ) : null}
                  <p className="whitespace-pre-line">{m.body}</p>
                  <p className={`mt-1 text-[11px] ${m.fromAdmin ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    {formatDateTime(m.createdAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-5 border-t pt-4">
          <MessageReplyForm ownerId={owner.id} />
        </div>
      </section>
    </div>
  );
}

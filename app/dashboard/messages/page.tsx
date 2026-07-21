import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Megaphone, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { getOwnerMessages, markOwnerThreadRead } from "@/lib/messages";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { MessageComposer } from "@/components/dashboard/message-composer";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Messages" };

export default async function OwnerMessagesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/messages");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });

  if (!owner) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader user={session.user} />
        <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
          <h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1>
          <p className="mt-3 rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">
            Messaging with the team opens once you begin owner verification.{" "}
            <Link href="/start" className="text-primary hover:underline">Get started</Link>.
          </p>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const messages = await getOwnerMessages(owner.id);
  await markOwnerThreadRead(owner.id);

  const notices = messages.filter((m) => m.isBroadcast);
  const direct = messages.filter((m) => !m.isBroadcast);

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Dashboard
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">Messages</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reach the Yewogen Derash team directly. Replies appear here.
        </p>

        {/* Broadcast notices */}
        {notices.length > 0 ? (
          <section className="mt-6 space-y-3">
            {notices.map((n) => (
              <div key={n.id} className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                <div className="flex items-center gap-2 text-primary">
                  <Megaphone className="h-4 w-4" aria-hidden />
                  <p className="text-sm font-semibold">{n.subject ?? "Notice"}</p>
                </div>
                <p className="mt-1.5 whitespace-pre-line text-sm text-foreground/85">{n.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</p>
              </div>
            ))}
          </section>
        ) : null}

        {/* Direct thread */}
        <section className="mt-6 rounded-xl border bg-card p-5 shadow-sm">
          {direct.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No messages yet. Send the team a message below.
            </p>
          ) : (
            <ul className="space-y-3">
              {direct.map((m) => (
                <li key={m.id} className={m.fromAdmin ? "flex justify-start" : "flex justify-end"}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                      m.fromAdmin
                        ? "rounded-tl-sm bg-muted text-foreground"
                        : "rounded-tr-sm bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.fromAdmin ? (
                      <p className="mb-1 flex items-center gap-1 text-xs font-semibold opacity-80">
                        <ShieldCheck className="h-3 w-3" aria-hidden /> Yewogen Derash team
                      </p>
                    ) : null}
                    <p className="whitespace-pre-line">{m.body}</p>
                    <p className={`mt-1 text-[11px] ${m.fromAdmin ? "text-muted-foreground" : "text-primary-foreground/70"}`}>
                      {formatDateTime(m.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 border-t pt-4">
            <MessageComposer />
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

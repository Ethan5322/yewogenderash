import Link from "next/link";
import { MessageSquare, Shield } from "lucide-react";
import { currentAdmin } from "@/lib/admin/permissions";
import { getStaffThread, listStaffThreads } from "@/lib/admin/staffMessages";
import { PageHeader, SectionCard } from "@/components/admin/ui";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sendStaffMessageAction } from "./actions";

export const metadata = { title: "Admin · Team chat" };

/**
 * The internal staff line.
 *
 * Guarded by currentAdmin() only — deliberately no requirePermission. Every
 * admin reaches this page whatever their capability map says, because a
 * sub-admin who can only do KYC still has to be able to answer the main admin.
 * The fundraiser line at /admin/messages keeps its `messages` gate; these two
 * are separate tables, separate pages, separate rules.
 */
export default async function TeamChatPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const me = await currentAdmin();
  const sp = await searchParams;
  const peerId = typeof sp.with === "string" ? sp.with : "";

  const threads = await listStaffThreads(me.id);
  // Opening a thread also marks its inbound messages read, so the badge in the
  // sidebar clears as a side effect of actually reading them.
  const thread = peerId ? await getStaffThread(me.id, peerId) : null;

  return (
    <div>
      <PageHeader
        title="Team chat"
        description="Private line between admins. Separate from fundraiser notices, and open to every admin regardless of permissions."
      />

      {threads.length === 0 ? (
        <SectionCard title="No one to message yet">
          <p className="p-4 text-sm text-muted-foreground">
            You are currently the only admin account. Add a colleague under{" "}
            <Link href="/admin/team" className="underline">
              Roles &amp; Team
            </Link>{" "}
            and they will appear here.
          </p>
        </SectionCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
          {/* ── People ─────────────────────────────────────────────── */}
          <SectionCard title="Admins" bodyClassName="p-0">
            <ul className="divide-y">
              {threads.map((t) => {
                const active = t.id === peerId;
                return (
                  <li key={t.id}>
                    <Link
                      href={`/admin/team-chat?with=${t.id}`}
                      className={cn(
                        "flex flex-col gap-0.5 px-4 py-3 transition-colors hover:bg-muted/50",
                        active && "bg-muted"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{t.name}</span>
                        {t.isSuperAdmin ? (
                          <Shield size={12} className="shrink-0 text-amber-500" aria-label="Main admin" />
                        ) : null}
                        {t.unread > 0 ? (
                          <span className="ml-auto shrink-0 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                            {t.unread}
                          </span>
                        ) : null}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {t.lastBody ?? (t.adminCode || t.email)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </SectionCard>

          {/* ── Thread ─────────────────────────────────────────────── */}
          <SectionCard
            title={thread ? thread.peer.name : "Select an admin"}
            sub={
              thread
                ? `${thread.peer.isSuperAdmin ? "Main admin" : "Delegated admin"}${
                    thread.peer.adminCode ? ` · ${thread.peer.adminCode}` : ""
                  }`
                : undefined
            }
          >
            {!thread ? (
              <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <MessageSquare size={16} /> Choose someone on the left to open the conversation.
              </p>
            ) : (
              <div className="flex flex-col">
                <ol className="flex max-h-[55vh] flex-col gap-3 overflow-y-auto p-4">
                  {thread.messages.length === 0 ? (
                    <li className="text-sm text-muted-foreground">
                      No messages yet. Write the first one below.
                    </li>
                  ) : (
                    thread.messages.map((m) => (
                      <li
                        key={m.id}
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          m.mine
                            ? "self-end bg-primary text-primary-foreground"
                            : "self-start bg-muted"
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p
                          className={cn(
                            "mt-1 text-[10px]",
                            m.mine ? "text-primary-foreground/70" : "text-muted-foreground"
                          )}
                        >
                          {formatDateTime(m.createdAt)}
                          {m.mine ? (m.readAt ? " · Read" : " · Sent") : ""}
                        </p>
                      </li>
                    ))
                  )}
                </ol>

                <form action={sendStaffMessageAction} className="flex gap-2 border-t p-4">
                  <input type="hidden" name="peerId" value={thread.peer.id} />
                  <textarea
                    name="body"
                    required
                    rows={2}
                    maxLength={4000}
                    placeholder={`Message ${thread.peer.name}…`}
                    className="flex-1 resize-none rounded-md border bg-background px-3 py-2 text-sm"
                  />
                  <button
                    type="submit"
                    className="self-end rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                  >
                    Send
                  </button>
                </form>
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, BellRing } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { WhatsappPrefsForm } from "@/components/dashboard/whatsapp-prefs-form";
import { formatDate } from "@/lib/format";

export const metadata: Metadata = { title: "Settings" };

export default async function DashboardSettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/dashboard/settings");

  const owner = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: {
      whatsappAlerts: true,
      whatsappPhone: true,
      callmebotApiKey: true,
      notifications: {
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true,
          message: true,
          status: true,
          error: true,
          createdAt: true,
          sentAt: true,
        },
      },
    },
  });

  return (
    <>
      <SiteHeader user={session.user} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Dashboard
        </Link>
        <h1 className="mt-4 font-display text-2xl font-bold tracking-tight">
          Settings
        </h1>

        {!owner ? (
          <div className="mt-8 rounded-xl border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">
              Owner settings become available once you begin owner verification.
            </p>
          </div>
        ) : (
          <>
            <section className="mt-8 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold">
                <BellRing className="h-4 w-4" aria-hidden />
                WhatsApp donation alerts
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Get an instant WhatsApp message every time a donation to one of
                your campaigns is confirmed.
              </p>
              <div className="mt-5">
                <WhatsappPrefsForm
                  initial={{
                    whatsappAlerts: owner.whatsappAlerts,
                    whatsappPhone: owner.whatsappPhone ?? "",
                    callmebotApiKey: owner.callmebotApiKey ?? "",
                  }}
                />
              </div>
            </section>

            <section className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
              <h2 className="font-display text-base font-semibold">
                Recent notifications
              </h2>
              {owner.notifications.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Nothing yet — alerts appear here once donations arrive.
                </p>
              ) : (
                <ul className="mt-3 divide-y text-sm">
                  {owner.notifications.map((n) => (
                    <li key={n.id} className="py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <p className="min-w-0 flex-1">{n.message}</p>
                        <span
                          className={
                            n.status === "SENT"
                              ? "shrink-0 text-xs font-medium text-success"
                              : n.status === "FAILED"
                                ? "shrink-0 text-xs font-medium text-destructive"
                                : "shrink-0 text-xs font-medium text-muted-foreground"
                          }
                        >
                          {n.status}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDate(n.sentAt ?? n.createdAt)}
                        {n.error ? ` · ${n.error}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
      <SiteFooter />
    </>
  );
}

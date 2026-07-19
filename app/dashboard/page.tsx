import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // Server-side guard — middleware is the outer gate, never the only one.
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/dashboard");

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Hello, {session.user.name ?? "friend"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Signed in as {session.user.email} · role: {session.user.role}
        </p>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My donations</CardTitle>
              <CardDescription>
                Your donation history will appear here.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">My campaigns</CardTitle>
              <CardDescription>
                Verified owners can create campaigns with their own QR code and
                separated ledger.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href="/dashboard/campaigns">Open my campaigns</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/start">Owner verification</Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link href="/dashboard/settings">Settings</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

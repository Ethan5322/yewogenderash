import { auth } from "@/auth";
import { getDictionary } from "@/lib/i18n";
import { DictProvider } from "@/lib/dict-context";
import { SiteHeader } from "@/components/site/site-header";
import { DashboardNav } from "@/components/dashboard/dashboard-nav";
import { DashboardFooter } from "@/components/dashboard/dashboard-footer";

/**
 * The chrome every dashboard screen shares: header, section nav, footer.
 *
 * It used to be pasted into each page — ten copies, and TWICE in the two pages
 * that have an early-return branch, so fourteen places to keep in step. A new
 * screen shipped without navigation unless its author remembered, and the
 * payouts page had already drifted to a different outer wrapper than the rest.
 * Here it is structural: a page renders its own <main> and nothing else.
 *
 * The session is read here only to name the signed-in user in the header. The
 * auth REDIRECT deliberately stays in the pages: each one sends a logged-out
 * visitor to /login with its own path as callbackUrl, and a layout redirect
 * would fire first and flatten every one of those to /dashboard — so someone
 * heading for their payouts would sign in and land somewhere else. Moving it
 * here would have been a quiet regression in a place nobody looks twice at.
 * e2e/auth-gate.spec.ts guards the redirect itself.
 */
export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const dict = await getDictionary();

  return (
    <DictProvider dict={dict}>
      {/* min-h-screen + flex-col so a short page still pins the footer to the
          bottom of the window; pb-16 leaves room for the phone's fixed bottom
          nav bar, which would otherwise cover the last line of content. Both
          applied once here rather than on ten different <main> elements. */}
      <div className="flex min-h-screen flex-col pb-16 md:pb-0">
        <SiteHeader user={session?.user} />
        <DashboardNav />
        {children}
        <DashboardFooter />
      </div>
    </DictProvider>
  );
}

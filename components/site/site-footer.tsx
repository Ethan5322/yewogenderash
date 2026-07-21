import Link from "next/link";
import { Logo } from "@/components/site/logo";

const FOOTER_GROUPS = [
  {
    heading: "Platform",
    links: [
      { href: "/campaigns", label: "Browse campaigns" },
      { href: "/start", label: "Start a campaign" },
      { href: "/blog", label: "Blog" },
      { href: "/support", label: "Support" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/support/terms", label: "Terms & conditions" },
      { href: "/support/privacy", label: "Privacy policy" },
      { href: "/support/fees", label: "Fees & payouts" },
    ],
  },
  {
    heading: "Help",
    links: [
      { href: "/support/faq", label: "FAQ" },
      { href: "/support/contact", label: "Contact us" },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              A verified crowdfunding platform for Ethiopia. Every campaign is
              identity-checked. Every donation is tracked. Every payout is
              audited.
            </p>
          </div>

          {FOOTER_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </h3>
              <ul className="space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Campaign-owner entry point (not admin — admin sign-in is never
            shown on the public site). */}
        <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-xl border bg-background p-5 text-center sm:flex-row sm:text-left">
          <div>
            <p className="font-medium">Are you a campaign owner?</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Sign in to manage your campaigns, or get verified to start raising
              funds.
            </p>
          </div>
          <div className="flex shrink-0 gap-3">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/start"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Register as a campaign owner
            </Link>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>© {new Date().getFullYear()} Yewogen Derash. All rights reserved.</p>
          <p>
            Designed &amp; built by{" "}
            <a
              href="https://mulesoo.com"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground hover:text-primary"
            >
              MuleSoo Digital Services
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

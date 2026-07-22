import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { FooterOwnerCta } from "@/components/site/footer-owner-cta";

const FOOTER_GROUPS = [
  {
    heading: "Platform",
    links: [
      { href: "/campaigns", label: "Browse campaigns" },
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

        {/* Single campaign-owner entry — hidden on homepage & registration. */}
        <FooterOwnerCta />

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

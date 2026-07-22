import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { FooterOwnerCta } from "@/components/site/footer-owner-cta";
import type { Dict } from "@/lib/i18n";

const EN_FOOTER = {
  blurb:
    "A verified crowdfunding platform. Every campaign is identity-checked, every donation is tracked, and every payout is audited.",
  platform: "Platform",
  legal: "Legal",
  help: "Help",
  browse: "Browse campaigns",
  blog: "Blog",
  support: "Support",
  terms: "Terms & conditions",
  privacy: "Privacy policy",
  fees: "Fees & payouts",
  faq: "FAQ",
  contact: "Contact us",
  ownerQ: "Are you a campaign owner?",
  ownerSub: "Sign in to manage your campaigns, or get verified to start raising funds.",
  registerOwner: "Register as a campaign owner",
  rights: "All rights reserved.",
  builtBy: "Designed & built by",
};

export function SiteFooter({ dict }: { dict?: Dict }) {
  const t = dict?.footer ?? EN_FOOTER;
  const groups = [
    {
      heading: t.platform,
      links: [
        { href: "/campaigns", label: t.browse },
        { href: "/blog", label: t.blog },
        { href: "/support", label: t.support },
      ],
    },
    {
      heading: t.legal,
      links: [
        { href: "/support/terms", label: t.terms },
        { href: "/support/privacy", label: t.privacy },
        { href: "/support/fees", label: t.fees },
      ],
    },
    {
      heading: t.help,
      links: [
        { href: "/support/faq", label: t.faq },
        { href: "/support/contact", label: t.contact },
      ],
    },
  ];

  return (
    <footer className="border-t bg-card">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="space-y-3">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{t.blurb}</p>
          </div>

          {groups.map((group) => (
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
        <FooterOwnerCta
          heading={t.ownerQ}
          sub={t.ownerSub}
          signIn={dict?.nav.signIn ?? "Sign in"}
          register={t.registerOwner}
        />

        <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-6 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} Yewogen Derash. {t.rights}
          </p>
          <p>
            {t.builtBy}{" "}
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

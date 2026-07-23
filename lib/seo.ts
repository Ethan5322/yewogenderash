/**
 * Central SEO / GEO (generative-engine) config. Client-safe (no server-only) so
 * both metadata and JSON-LD builders can use it. SITE_URL falls back to the
 * production domain when the env isn't set (e.g. during a metadata build).
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || "https://yewogenderash.com"
).replace(/\/+$/, "");

export const SITE_NAME = "Yewogen Derash";
export const SITE_TAGLINE = "Verified Crowdfunding, Worldwide";
export const SITE_DESCRIPTION =
  "Yewogen Derash is a secure, verified crowdfunding platform for causes worldwide. Every campaign owner passes identity and biometric verification, every donation goes to exactly one campaign via its own querycode, and every payout is audited.";

/** Organization + WebSite JSON-LD for the whole site (helps Google + AI tools). */
export function siteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}/#organization`,
        name: SITE_NAME,
        url: SITE_URL,
        logo: `${SITE_URL}/brand/logo-mark.png`,
        description: SITE_DESCRIPTION,
        sameAs: [] as string[],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: SITE_NAME,
        description: SITE_DESCRIPTION,
        publisher: { "@id": `${SITE_URL}/#organization` },
        potentialAction: {
          "@type": "SearchAction",
          target: `${SITE_URL}/campaigns?q={search_term_string}`,
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

/** Per-campaign JSON-LD — a fundraising DonateAction with progress. */
export function campaignJsonLd(c: {
  title: string;
  description: string;
  slug: string;
  currency: string;
  targetAmount: number;
  currentAmount: number;
  heroImageUrl?: string | null;
  ownerName: string;
  category: string;
}) {
  const url = `${SITE_URL}/campaigns/${c.slug}`;
  return {
    "@context": "https://schema.org",
    "@type": "DonateAction",
    name: c.title,
    description: c.description,
    url,
    image: c.heroImageUrl || `${SITE_URL}/brand/logo-mark.png`,
    recipient: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    agent: { "@type": "Person", name: c.ownerName },
    priceSpecification: {
      "@type": "PriceSpecification",
      priceCurrency: c.currency,
      price: c.targetAmount,
    },
    // Non-standard but widely-read extras for progress:
    additionalProperty: [
      { "@type": "PropertyValue", name: "Raised", value: c.currentAmount },
      { "@type": "PropertyValue", name: "Goal", value: c.targetAmount },
      { "@type": "PropertyValue", name: "Category", value: c.category },
    ],
  };
}

/** Small helper to embed JSON-LD safely. */
export function jsonLdScript(data: object) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

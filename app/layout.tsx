import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale } from "@/lib/i18n";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, siteJsonLd, jsonLdScript } from "@/lib/seo";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: SITE_NAME,
  title: {
    template: "%s | Yewogen Derash",
    default: "Yewogen Derash — Verified Crowdfunding, Worldwide",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "crowdfunding",
    "donate online",
    "verified fundraising",
    "Yewogen Derash",
    "medical fundraising",
    "global crowdfunding",
  ],
  robots: { index: true, follow: true, "max-image-preview": "large" },
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    url: SITE_URL,
    title: "Yewogen Derash — Verified Crowdfunding, Worldwide",
    description: SITE_DESCRIPTION,
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Yewogen Derash — Verified Crowdfunding, Worldwide",
    description: SITE_DESCRIPTION,
    images: ["/opengraph-image"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${jakarta.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(siteJsonLd())}
        />
        {children}
      </body>
    </html>
  );
}

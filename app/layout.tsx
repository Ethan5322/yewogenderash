import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { getLocale } from "@/lib/i18n";
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
  title: {
    template: "%s | Yewogen Derash",
    default: "Yewogen Derash — Verified Crowdfunding, Worldwide",
  },
  description:
    "Yewogen Derash is a secure, verified crowdfunding platform for causes worldwide. Every campaign is identity-verified, every donation goes to exactly one campaign, and every payout is audited.",
  keywords: [
    "crowdfunding",
    "donate online",
    "verified fundraising",
    "Yewogen Derash",
    "medical fundraising",
    "global crowdfunding",
  ],
  robots: { index: true, follow: true },
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

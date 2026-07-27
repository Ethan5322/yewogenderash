import Link from "next/link";
import { Languages } from "lucide-react";
import { getLocale, getDictionary } from "@/lib/i18n";

/**
 * Tells an Amharic reader, in Amharic, that a legal document is English-only.
 *
 * The rest of the site is fully bilingual, so arriving at the Terms in English
 * with no explanation reads as a broken translation. It is not: these documents
 * are deliberately not machine-translated, because an inexact rendering of a
 * binding clause could mislead someone about what they are agreeing to. The
 * English text stays authoritative and this points at a human who can explain it.
 *
 * Renders nothing for English readers.
 */
export async function LegalLanguageNotice() {
  const [locale, dict] = await Promise.all([getLocale(), getDictionary()]);
  if (locale === "en") return null;

  const t = dict.legal;
  return (
    <div className="mb-8 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold">
        <Languages className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {t.englishOnlyTitle}
      </p>
      <p className="mt-2 text-sm text-muted-foreground">{t.englishOnlyBody}</p>
      <Link
        href="/support/contact"
        className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
      >
        {t.contactLink}
      </Link>
    </div>
  );
}

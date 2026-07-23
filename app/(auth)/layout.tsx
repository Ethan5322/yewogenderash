import Link from "next/link";
import { Logo } from "@/components/site/logo";
import { LanguageSwitcher } from "@/components/site/language-switcher";
import { getDictionary } from "@/lib/i18n";
import { DictProvider } from "@/lib/dict-context";

export default async function AuthLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const dict = await getDictionary();
  return (
    <DictProvider dict={dict}>
      <div className="flex min-h-screen flex-col">
        <header className="border-b">
          <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Logo />
            <div className="flex items-center gap-3">
              <LanguageSwitcher label={dict.switchLabel} />
              <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
                ← {dict.nav.home}
              </Link>
            </div>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-4 py-12">
          {children}
        </main>
      </div>
    </DictProvider>
  );
}

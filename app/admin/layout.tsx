import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Logo } from "@/components/site/logo";

export const metadata = { title: "Admin" };

/**
 * Admin shell. Role is re-verified SERVER-SIDE here on every request —
 * middleware alone is never trusted for the financial control room.
 */
export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  if (!session?.user) redirect("/login?callbackUrl=/admin");
  if (session.user.role !== "ADMIN") redirect("/");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Logo />
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              ADMIN
            </span>
          </div>
          <span className="text-xs text-muted-foreground">
            {session.user.email}
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOwnerContext, computeOnboardingState } from "@/lib/owner";
import { ConsentForm } from "@/components/onboarding/consent-form";
import { getDictionary } from "@/lib/i18n";

export const metadata: Metadata = { title: "Terms & consent · Owner verification" };

export default async function TermsStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");

  const ctx = await getOwnerContext(session.user.id);
  if (!ctx) redirect("/login?callbackUrl=/start/verify");

  // Enforce step order — contact must be verified first.
  const state = computeOnboardingState(ctx);
  if (!state.emailVerified || !state.phonePresent) redirect("/start/verify");

  const t = (await getDictionary()).wizard;

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        {t.termsHeading}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t.termsSub}</p>

      <div className="mt-6">
        <ConsentForm />
      </div>
    </section>
  );
}

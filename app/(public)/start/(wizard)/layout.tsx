import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOwnerContext, computeOnboardingState } from "@/lib/owner";
import { WizardShell } from "@/components/onboarding/wizard-shell";
import type { WizardFlags } from "@/components/onboarding/wizard-steps";

export default async function WizardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");

  const ctx = await getOwnerContext(session.user.id);
  if (!ctx) redirect("/login?callbackUrl=/start/verify");

  const state = computeOnboardingState(ctx);
  const flags: WizardFlags = {
    verifyDone: state.emailVerified && state.phoneVerified,
    termsDone: state.consentDone,
    documentsDone: state.documentsDone,
    reviewDone: state.submitted,
  };

  return <WizardShell flags={flags}>{children}</WizardShell>;
}

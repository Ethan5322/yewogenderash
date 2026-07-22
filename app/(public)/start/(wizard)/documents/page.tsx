import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOwnerContext, computeOnboardingState } from "@/lib/owner";
import { DocumentsForm } from "@/components/onboarding/documents-form";

export const metadata: Metadata = { title: "Documents & payout · Owner verification" };

export default async function DocumentsStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");

  const ctx = await getOwnerContext(session.user.id);
  if (!ctx) redirect("/login?callbackUrl=/start/verify");

  const state = computeOnboardingState(ctx);
  if (!state.emailVerified || !state.phonePresent) redirect("/start/verify");
  if (!state.consentDone) redirect("/start/terms");

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Identity, payout & documents
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Provide your ID details, where funds should be paid out, and upload your
        identity plus a document supporting your cause.
      </p>

      <div className="mt-6">
        <DocumentsForm />
      </div>
    </section>
  );
}

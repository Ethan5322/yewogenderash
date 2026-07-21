import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2, Circle, ScanFace, PhoneCall } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import {
  getOwnerContext,
  computeOnboardingState,
  canSubmitForReview,
} from "@/lib/owner";
import { SelfieCapture } from "@/components/onboarding/selfie-capture";
import { SubmitReview } from "@/components/onboarding/submit-review";
import { IdPhotoUpload } from "@/components/owner/id-photo-upload";

export const metadata: Metadata = { title: "Face & submit · Owner verification" };

function ChecklistRow({ done, label }: { done: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      {done ? (
        <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </li>
  );
}

export default async function ReviewStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");

  const ctx = await getOwnerContext(session.user.id);
  if (!ctx) redirect("/login?callbackUrl=/start/verify");

  const state = computeOnboardingState(ctx);
  if (!state.emailVerified || !state.phoneVerified) redirect("/start/verify");
  if (!state.consentDone) redirect("/start/terms");
  if (!state.documentsDone) redirect("/start/documents");

  // Already submitted — show the completion confirmation.
  if (state.submitted) {
    return (
      <section className="rounded-xl border bg-card p-8 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-success/15 text-success">
          {state.approved ? (
            <CheckCircle2 className="h-7 w-7" aria-hidden />
          ) : (
            <PhoneCall className="h-7 w-7" aria-hidden />
          )}
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold">
          {state.approved ? "You're a verified owner" : "Application completed"}
        </h2>
        {state.approved ? (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your identity is verified. You can now create campaigns.
          </p>
        ) : (
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            Your documents have been saved and sent to our administrators. We
            will evaluate them and{" "}
            <span className="font-medium text-foreground">
              call you on {ctx.phone ?? "the number you provided"}
            </span>{" "}
            to complete your verification.
          </p>
        )}
        <div className="mt-6">
          <Button asChild>
            <Link href={state.approved ? "/dashboard/campaigns/new" : "/dashboard"}>
              {state.approved ? "Create a campaign" : "Close"}
            </Link>
          </Button>
        </div>
      </section>
    );
  }

  const ready = canSubmitForReview(state);
  const idPhoto = await db.campaignOwner.findUnique({
    where: { userId: session.user.id },
    select: { idPhotoUrl: true },
  });

  return (
    <section className="space-y-8">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          Face verification
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Take a live selfie so we can match it to your ID. A human reviewer
          confirms the match — this is the final anti-fraud check.
        </p>

        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          {state.biometricDone ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-success/15 text-success">
                <ScanFace className="h-5 w-5" aria-hidden />
              </span>
              <div>
                <p className="font-medium text-foreground">Selfie captured</p>
                <p className="text-muted-foreground">
                  Pending reviewer confirmation. You can submit now.
                </p>
              </div>
            </div>
          ) : (
            <SelfieCapture />
          )}
        </div>
      </div>

      {/* ID card photo — uploaded after the biometric capture, auto-cropped and
          placed on the Fundraiser ID that is issued once an admin approves. */}
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">
          ID card photo
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a clear photo of your face from your gallery. It is auto-cropped
          and placed on your corporate Fundraiser ID. Your ID stays locked until
          an administrator approves your verification.
        </p>
        <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
          <IdPhotoUpload hasPhoto={!!idPhoto?.idPhotoUrl} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-base font-semibold">Before you submit</h3>
        <ul className="mt-3 space-y-2">
          <ChecklistRow done={state.emailVerified && state.phonePresent} label="Email verified · phone on file" />
          <ChecklistRow done={state.consentDone} label="Terms, fees & consent accepted" />
          <ChecklistRow done={state.identityDone} label="Identity & payout details provided" />
          <ChecklistRow done={state.primaryIdUploaded} label="ID document uploaded" />
          <ChecklistRow done={state.supportingUploaded} label="Supporting document uploaded" />
          <ChecklistRow done={state.biometricDone} label="Live selfie captured" />
        </ul>
      </div>

      <div className="border-t pt-6">
        <p className="mb-4 text-sm text-muted-foreground">
          Submitting locks your application for admin review. You&apos;ll be able
          to create campaigns once you&apos;re approved.
        </p>
        <SubmitReview disabled={!ready} />
      </div>
    </section>
  );
}

import "server-only";
import type { Prisma, VerificationStatus } from "@prisma/client";
import { db } from "@/lib/db";

// The identity documents that satisfy the "primary ID" requirement.
const PRIMARY_ID_TYPES = ["NATIONAL_ID", "PASSPORT"] as const;
// Documents that count as cause/supporting evidence.
const SUPPORTING_TYPES = [
  "MEDICAL_LETTER",
  "EDUCATION_LETTER",
  "COMMUNITY_LETTER",
  "BUSINESS_REGISTRATION",
  "PROOF_OF_ADDRESS",
  "OTHER_SUPPORTING",
] as const;

const ownerInclude = {
  ownerProfile: { include: { documents: { orderBy: { createdAt: "desc" } } } },
} satisfies Prisma.UserInclude;

export type OwnerContext = Prisma.UserGetPayload<{ include: typeof ownerInclude }>;

/** Load a user with their owner profile + documents (null profile if none yet). */
export async function getOwnerContext(userId: string): Promise<OwnerContext | null> {
  return db.user.findUnique({ where: { id: userId }, include: ownerInclude });
}

/** Create the CampaignOwner row on first onboarding action if it doesn't exist. */
export async function ensureOwnerProfile(userId: string) {
  const existing = await db.campaignOwner.findUnique({ where: { userId } });
  if (existing) return existing;
  return db.campaignOwner.create({ data: { userId } });
}

export type OnboardingState = {
  hasProfile: boolean;
  emailVerified: boolean;
  phoneVerified: boolean;
  /** A phone is on file (verified by the admin's call, not by OTP). */
  phonePresent: boolean;
  consentDone: boolean;
  identityDone: boolean;
  primaryIdUploaded: boolean;
  supportingUploaded: boolean;
  documentsDone: boolean;
  biometricDone: boolean;
  submitted: boolean;
  approved: boolean;
  verificationStatus: VerificationStatus;
  /** Route of the first incomplete step — where "continue" should land. */
  nextStep: string;
};

/**
 * Compute onboarding progress from an OwnerContext. Pure/deterministic so both
 * the wizard layout and individual step guards agree on what's done.
 */
export function computeOnboardingState(ctx: OwnerContext): OnboardingState {
  const owner = ctx.ownerProfile;
  const documents = owner?.documents ?? [];

  const emailVerified = !!ctx.emailVerifiedAt;
  const phoneVerified = !!ctx.phoneVerifiedAt;
  // The email is verified by OTP; the phone is only collected here and verified
  // by the admin's call during evaluation — so "contact done" needs a phone on
  // file, not a phone OTP.
  const phonePresent = !!ctx.phone;
  const consentDone =
    !!owner?.termsAcceptedAt &&
    !!owner?.feesAcceptedAt &&
    !!owner?.biometricConsentAt;

  const identityDone = !!owner?.idNumber && !!owner?.payoutAccount;
  const primaryIdUploaded = documents.some((d) =>
    (PRIMARY_ID_TYPES as readonly string[]).includes(d.documentType)
  );
  const supportingUploaded = documents.some((d) =>
    (SUPPORTING_TYPES as readonly string[]).includes(d.documentType)
  );
  const documentsDone = identityDone && primaryIdUploaded && supportingUploaded;
  const biometricDone = !!owner && owner.biometricStatus !== "NOT_CAPTURED";

  const status = ctx.verificationStatus;
  const submitted =
    status === "PENDING" || status === "VERIFIED" || status === "REJECTED";
  const approved = status === "VERIFIED";

  let nextStep = "/start/verify";
  if (!emailVerified || !phonePresent) nextStep = "/start/verify";
  else if (!consentDone) nextStep = "/start/terms";
  else if (!documentsDone) nextStep = "/start/documents";
  else if (!biometricDone) nextStep = "/start/review";
  else nextStep = "/start/review";

  return {
    hasProfile: !!owner,
    emailVerified,
    phoneVerified,
    phonePresent,
    consentDone,
    identityDone,
    primaryIdUploaded,
    supportingUploaded,
    documentsDone,
    biometricDone,
    submitted,
    approved,
    verificationStatus: status,
    nextStep,
  };
}

/** True when the owner has completed everything required to submit for review. */
export function canSubmitForReview(state: OnboardingState): boolean {
  return (
    state.emailVerified &&
    state.phonePresent &&
    state.consentDone &&
    state.documentsDone &&
    state.biometricDone &&
    !state.submitted
  );
}

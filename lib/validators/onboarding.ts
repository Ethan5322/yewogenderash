import { z } from "zod";

// ── Terms, fees & biometric consent ──────────────────────────────
// Each must be explicitly accepted (checkbox === true) before onboarding
// can continue — the platform records the timestamp of each acceptance.
export const consentSchema = z.object({
  acceptTerms: z.literal(true, {
    error: "You must accept the terms and conditions",
  }),
  acceptFees: z.literal(true, {
    error: "You must accept the fee and payout policy",
  }),
  biometricConsent: z.literal(true, {
    error: "Face verification consent is required to continue",
  }),
});
export type ConsentInput = z.infer<typeof consentSchema>;

// ── Payout account ───────────────────────────────────────────────
export const payoutAccountSchema = z.object({
  accountType: z.enum(["BANK", "TELEBIRR"], {
    error: "Choose a payout method",
  }),
  accountName: z
    .string()
    .trim()
    .min(2, "Enter the account holder name")
    .max(120),
  accountNumber: z
    .string()
    .trim()
    .min(6, "Enter a valid account or phone number")
    .max(40),
  bankName: z.string().trim().max(80).optional().or(z.literal("")),
});
export type PayoutAccountInput = z.infer<typeof payoutAccountSchema>;

// ── Owner identity details ───────────────────────────────────────
export const ownerIdentitySchema = z.object({
  idNumber: z
    .string()
    .trim()
    .min(4, "Enter your ID or passport number")
    .max(40),
});
export type OwnerIdentityInput = z.infer<typeof ownerIdentitySchema>;

// ── Document upload (metadata; the file itself is validated separately) ──
// Only the document types an owner uploads during onboarding are allowed here;
// SELFIE is captured through the biometric step, not this generic uploader.
export const uploadDocTypeSchema = z.enum([
  "NATIONAL_ID",
  "PASSPORT",
  "PROOF_OF_ADDRESS",
  "MEDICAL_LETTER",
  "EDUCATION_LETTER",
  "COMMUNITY_LETTER",
  "BUSINESS_REGISTRATION",
  "OTHER_SUPPORTING",
]);
export type UploadDocType = z.infer<typeof uploadDocTypeSchema>;

// ── WhatsApp alert preferences (owner dashboard) ─────────────────
export const whatsappPrefsSchema = z.object({
  whatsappAlerts: z.boolean(),
  whatsappPhone: z
    .string()
    .trim()
    .regex(/^\+?[0-9\s-]{9,15}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
  callmebotApiKey: z.string().trim().max(120).optional().or(z.literal("")),
});
export type WhatsappPrefsInput = z.infer<typeof whatsappPrefsSchema>;

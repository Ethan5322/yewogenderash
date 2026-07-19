import { z } from "zod";

export const campaignCategorySchema = z.enum([
  "MEDICAL",
  "EDUCATION",
  "COMMUNITY",
  "BUSINESS",
  "EMERGENCY",
  "OTHER",
]);

// Money bounds: ETB 1,000 minimum keeps spam out; 10M cap fits Decimal(12,2)
// with air to spare and flags anything implausible for manual handling.
export const campaignCreateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(8, "Title must be at least 8 characters")
    .max(90, "Keep the title under 90 characters"),
  description: z
    .string()
    .trim()
    .min(40, "Describe the campaign in at least 40 characters")
    .max(300, "Keep the summary under 300 characters"),
  story: z
    .string()
    .trim()
    .min(120, "Tell the full story — at least 120 characters")
    .max(10_000, "Story is too long"),
  category: campaignCategorySchema,
  targetAmount: z.coerce
    .number()
    .int("Whole birr only")
    .min(1_000, "Minimum target is ETB 1,000")
    .max(10_000_000, "Targets above ETB 10M require manual review — contact support"),
  location: z.string().trim().max(80).optional().or(z.literal("")),
  endDate: z
    .string()
    .optional()
    .or(z.literal(""))
    .refine(
      (v) => !v || new Date(v).getTime() > Date.now(),
      "End date must be in the future"
    ),
});

export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

// Admin review decisions.
export const reviewDecisionSchema = z.object({
  campaignId: z.string().min(1),
  note: z.string().trim().max(1_000).optional().or(z.literal("")),
});

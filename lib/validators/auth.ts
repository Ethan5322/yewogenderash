import { z } from "zod";

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Enter your full name")
    .max(100, "Name is too long"),
  email: z.email("Enter a valid email address").max(190),
  // International phone (any country). Permissive on formatting (+, spaces,
  // dashes, parentheses) but must contain 7–15 digits per E.164.
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9().\s-]{7,20}$/,
      "Enter a valid phone number with country code, e.g. +27 82 123 4567"
    )
    .refine(
      (v) => {
        const digits = v.replace(/\D/g, "");
        return digits.length >= 7 && digits.length <= 15;
      },
      "Enter a valid phone number with country code, e.g. +27 82 123 4567"
    )
    .optional()
    .or(z.literal("")),
  password: z
    .string()
    .min(8, "At least 8 characters")
    .max(100)
    .regex(/[a-zA-Z]/, "Must include a letter")
    .regex(/[0-9]/, "Must include a number"),
});

// Recovery accepts EITHER an email OR a fundraiser verification code (YWD-…),
// because a fundraiser knows the code on their ID card better than which email
// address they signed up with. The action decides which one it is.
export const forgotPasswordSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, "Enter your email or fundraiser code")
    .max(190),
});

/** True for a fundraiser verification code like "YWD-7KQ2". */
export function isFundraiserCode(value: string): boolean {
  return /^YWD-[A-Z0-9]{4,10}$/.test(value.trim().toUpperCase());
}

/** Same strength rules as registration, plus a confirmation field. */
const newPassword = z
  .string()
  .min(8, "At least 8 characters")
  .max(100)
  .regex(/[a-zA-Z]/, "Must include a letter")
  .regex(/[0-9]/, "Must include a number");

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

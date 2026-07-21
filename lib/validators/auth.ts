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

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

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
  phone: z
    .string()
    .trim()
    .regex(
      /^\+?[0-9\s-]{9,15}$/,
      "Enter a valid phone number (e.g. +2519...)"
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

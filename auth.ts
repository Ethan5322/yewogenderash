import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { verifyOtp } from "@/lib/auth/otp";
import { loginSchema } from "@/lib/validators/auth";

/**
 * Full Auth.js setup (Node runtime). Middleware uses auth.config.ts instead —
 * this file pulls in Prisma + bcrypt and must never run on the edge.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
        code: {}, // 2FA code — required for ADMIN accounts
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const email = parsed.data.email.toLowerCase().trim();
        const user = await db.user.findUnique({ where: { email } });
        if (!user || user.isBanned) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        // Second factor is MANDATORY for admins — they can only sign in through
        // the /admin-login flow, which supplies a valid one-time code. Password
        // alone never grants an admin session.
        if (user.role === "ADMIN") {
          const code = typeof credentials?.code === "string" ? credentials.code : "";
          const otp = await verifyOtp(user.id, "LOGIN_2FA", code);
          if (!otp.ok) return null;
        }

        // Shape consumed by the jwt callback in auth.config.ts
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
});

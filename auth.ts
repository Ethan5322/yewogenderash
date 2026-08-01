import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { verifyOtp } from "@/lib/auth/otp";
import { lockState, recordFailedLogin, clearFailedLogins } from "@/lib/auth/lockout";
import { loginSchema } from "@/lib/validators/auth";
import { writeAudit } from "@/lib/audit";
import { faceDistance, parseDescriptor, MATCH_THRESHOLD } from "@/lib/face/distance";

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

        // Brute-force gate. Sign-in was the one public write path in this app
        // with no limit of any kind: unlimited password guesses, no counter, no
        // delay. Returning null (not a distinct error) keeps the response
        // identical to a wrong password, so a lockout cannot be used to discover
        // which email addresses exist.
        if (lockState(user).locked) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) {
          await recordFailedLogin(user);
          return null;
        }

        // Second factor is MANDATORY for admins — they can only sign in through
        // the /admin-login flow, which supplies a valid one-time code. Password
        // alone never grants an admin session.
        if (user.role === "ADMIN") {
          const code = typeof credentials?.code === "string" ? credentials.code : "";
          const otp = await verifyOtp(user.id, "LOGIN_2FA", code);
          if (!otp.ok) {
            // A wrong second factor counts as a failed sign-in too. Otherwise an
            // attacker who already has the password can grind the 6-digit code
            // without ever tripping the password counter.
            await recordFailedLogin(user);
            return null;
          }
        }

        // Correct password (and second factor, for admins) — forget the failures.
        // A user who mistypes twice and then succeeds must not carry that toward a
        // lock next week.
        await clearFailedLogins(user);

        // Shape consumed by the jwt callback in auth.config.ts
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),

    // Fundraiser sign-in by verification code. The code printed on the
    // Fundraiser ID identifies the account; EITHER credential then proves it —
    // the face enrolled at registration, or the password chosen at
    // registration. Both are offered as options; one is enough. (Email +
    // password on /login stays a third way in.) Admins are excluded here; they
    // use the staff flows below.
    Credentials({
      id: "fundraiser-code",
      name: "Fundraiser code",
      credentials: { code: {}, password: {}, faceDescriptor: {} },
      async authorize(credentials) {
        const code = String(credentials?.code ?? "").trim().toUpperCase();
        const password = String(credentials?.password ?? "");
        if (!/^YWD-[A-Z0-9]{4,10}$/.test(code)) return null;

        const owner = await db.campaignOwner.findUnique({
          where: { authorCode: code },
          select: {
            id: true,
            faceDescriptor: true,
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
                isBanned: true,
                passwordHash: true,
              },
            },
          },
        });
        const user = owner?.user;
        if (!user || user.isBanned || user.role !== "OWNER") return null;

        // Option A — biometric: the live face must match the template captured
        // during registration (which can never be changed afterwards).
        const enrolled = parseDescriptor(owner?.faceDescriptor);
        const probe = parseDescriptor(credentials?.faceDescriptor);
        if (enrolled && probe && faceDistance(enrolled, probe) < MATCH_THRESHOLD) {
          await writeAudit({
            actorId: user.id,
            action: "OWNER_FACE_LOGIN",
            entityType: "CampaignOwner",
            entityId: owner!.id,
          });
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }

        // Option B — the password chosen at registration.
        if (password && (await verifyPassword(password, user.passwordHash))) {
          return { id: user.id, name: user.name, email: user.email, role: user.role };
        }

        return null;
      },
    }),

    // Staff sign-in by verification code. The staff code (YWD-ADM-XXXX)
    // identifies the admin; EITHER their enrolled face or their password then
    // proves it, so no emailed code is needed on this route. Email + password +
    // emailed code (the provider above) remains available as a third option.
    Credentials({
      id: "admin-code",
      name: "Staff code",
      credentials: { code: {}, password: {}, faceDescriptor: {} },
      async authorize(credentials) {
        const code = String(credentials?.code ?? "").trim().toUpperCase();
        const password = String(credentials?.password ?? "");
        if (!/^YWD-ADM-[A-Z0-9]{2,12}$/.test(code)) return null;

        const user = await db.user.findUnique({
          where: { adminCode: code },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            isBanned: true,
            passwordHash: true,
            faceDescriptor: true,
          },
        });
        if (!user || user.isBanned || user.role !== "ADMIN") return null;

        const session = { id: user.id, name: user.name, email: user.email, role: user.role };

        // Option A — biometric.
        const enrolled = parseDescriptor(user.faceDescriptor);
        const probe = parseDescriptor(credentials?.faceDescriptor);
        if (enrolled && probe && faceDistance(enrolled, probe) < MATCH_THRESHOLD) {
          await writeAudit({
            actorId: user.id,
            action: "ADMIN_FACE_LOGIN",
            entityType: "User",
            entityId: user.id,
            detail: { adminCode: code },
          });
          return session;
        }

        // Option B — staff password.
        if (password && (await verifyPassword(password, user.passwordHash))) {
          await writeAudit({
            actorId: user.id,
            action: "ADMIN_CODE_LOGIN",
            entityType: "User",
            entityId: user.id,
            detail: { adminCode: code },
          });
          return session;
        }

        return null;
      },
    }),
  ],
});

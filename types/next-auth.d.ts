import type { DefaultSession } from "next-auth";

type AppRole = "DONOR" | "OWNER" | "ADMIN";

declare module "next-auth" {
  interface User {
    role: AppRole;
  }
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
  }
}

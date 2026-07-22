import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { createOtp, deliverOtp } from "@/lib/auth/otp";
import { rateLimit, ipKey, tooManyResponse } from "@/lib/rate-limit";

const requestSchema = z.object({
  purpose: z.enum(["EMAIL_VERIFY", "PHONE_VERIFY"]),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Per-user resend cooldown is DB-backed (see createOtp); this caps burst
  // volume from one source/session on top of it.
  const byUser = rateLimit(`otp-req:${session.user.id}`, 6, 10 * 60_000);
  if (!byUser.ok) return tooManyResponse(byUser);
  const byIp = rateLimit(ipKey(req, "otp-req"), 12, 10 * 60_000);
  if (!byIp.ok) return tooManyResponse(byIp);

  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid purpose" }, { status: 400 });
  }

  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { purpose } = parsed.data;
  if (purpose === "PHONE_VERIFY" && !user.phone) {
    return NextResponse.json(
      { error: "Add a phone number to your account first." },
      { status: 400 }
    );
  }

  const result = await createOtp(user.id, purpose);
  if (!result.ok) {
    return NextResponse.json(
      { error: "Please wait a few seconds before requesting another code." },
      { status: 429 }
    );
  }

  const delivery = await deliverOtp({
    purpose,
    email: user.email,
    phone: user.phone,
    code: result.code,
  });

  // DEV ONLY: surface the code to the UI so testing needs no SMS/email or
  // console digging. Never included in production builds.
  const devCode =
    process.env.NODE_ENV === "development" ? result.code : undefined;

  // In production, if email is configured but delivery failed (e.g. the sending
  // domain isn't verified yet, so Resend only allows the account address), tell
  // the user instead of leaving them waiting for a code that never arrives.
  if (!devCode && delivery.emailConfigured && !delivery.emailSent) {
    return NextResponse.json(
      { error: "We couldn't send your code right now. Please try again shortly or contact support." },
      { status: 502 }
    );
  }

  return NextResponse.json(devCode ? { ok: true, devCode } : { ok: true });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyOtp } from "@/lib/auth/otp";
import { writeAudit, clientIp } from "@/lib/audit";
import { rateLimit, ipKey, tooManyResponse } from "@/lib/rate-limit";

const verifySchema = z.object({
  purpose: z.enum(["EMAIL_VERIFY", "PHONE_VERIFY"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Brute-force guard: a 6-digit code must not be guessable by volume. Cap
  // attempts per user AND per source over the code's 10-minute lifetime.
  const byUser = rateLimit(`otp-verify:${session.user.id}`, 8, 10 * 60_000);
  if (!byUser.ok) return tooManyResponse(byUser, "Too many attempts. Request a new code and wait a few minutes.");
  const byIp = rateLimit(ipKey(req, "otp-verify"), 20, 10 * 60_000);
  if (!byIp.ok) return tooManyResponse(byIp, "Too many attempts. Request a new code and wait a few minutes.");

  const parsed = verifySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  const result = await verifyOtp(
    session.user.id,
    parsed.data.purpose,
    parsed.data.code
  );

  if (!result.ok) {
    return NextResponse.json(
      { error: "Wrong or expired code. Request a new one." },
      { status: 400 }
    );
  }

  await writeAudit({
    actorId: session.user.id,
    action: `OTP_VERIFIED_${parsed.data.purpose}`,
    entityType: "User",
    entityId: session.user.id,
    ipAddress: clientIp(req),
  });

  return NextResponse.json({ ok: true });
}

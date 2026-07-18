import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { verifyOtp } from "@/lib/auth/otp";
import { writeAudit, clientIp } from "@/lib/audit";

const verifySchema = z.object({
  purpose: z.enum(["EMAIL_VERIFY", "PHONE_VERIFY"]),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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

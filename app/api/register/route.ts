import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { registerSchema } from "@/lib/validators/auth";
import { writeAudit, clientIp } from "@/lib/audit";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email.toLowerCase().trim();
  const phone = parsed.data.phone?.trim() || null;

  try {
    const user = await db.user.create({
      data: {
        name,
        email,
        phone,
        passwordHash: await hashPassword(password),
        role: "DONOR",
      },
      select: { id: true, email: true },
    });

    await writeAudit({
      actorId: user.id,
      action: "USER_REGISTERED",
      entityType: "User",
      entityId: user.id,
      ipAddress: clientIp(req),
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "An account with this email or phone already exists." },
        { status: 409 }
      );
    }
    console.error("[register] error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

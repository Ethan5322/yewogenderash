import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { OtpVerifyPanel } from "@/components/onboarding/otp-verify-panel";

export const metadata: Metadata = { title: "Verify contact · Owner verification" };

export default async function VerifyStep() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/start/verify");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: {
      email: true,
      phone: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    },
  });
  if (!user) redirect("/login?callbackUrl=/start/verify");

  const emailVerified = !!user.emailVerifiedAt;
  const phoneVerified = !!user.phoneVerifiedAt;
  const bothDone = emailVerified && phoneVerified;

  return (
    <section>
      <h2 className="font-display text-xl font-semibold tracking-tight">
        Verify your email and phone
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        We confirm both so donors can trust that a real, reachable person is
        behind every campaign.
      </p>

      <div className="mt-6">
        <OtpVerifyPanel
          email={user.email}
          phone={user.phone}
          emailVerified={emailVerified}
          phoneVerified={phoneVerified}
        />
      </div>

      <div className="mt-8 flex justify-end">
        {bothDone ? (
          <Button asChild>
            <Link href="/start/terms">
              Continue <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button disabled>
            Continue <ArrowRight className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </section>
  );
}

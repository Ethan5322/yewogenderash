import Link from "next/link";
import { findValidResetToken } from "@/lib/auth/password-reset";
import { ResetPasswordForm } from "./reset-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "Choose a new password" };

/**
 * Landing page for the emailed reset link. The token is checked here so an
 * expired or already-used link says so immediately, rather than after someone
 * has typed a new password twice.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const record = token ? await findValidResetToken(token) : null;

  if (!record) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl">This link has expired</CardTitle>
          <CardDescription>
            Reset links last 1 hour and can only be used once. Request a fresh
            one and open the most recent email.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button asChild className="w-full">
            <Link href="/forgot-password">Send a new link</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Back to sign in</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Choose a new password</CardTitle>
        <CardDescription>
          Pick something you don&apos;t use anywhere else. At least 8 characters,
          with a letter and a number.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token as string} />
      </CardContent>
    </Card>
  );
}

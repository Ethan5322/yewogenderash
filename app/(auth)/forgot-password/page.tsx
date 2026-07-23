"use client";

import * as React from "react";
import Link from "next/link";
import { Loader2, MailCheck } from "lucide-react";
import { requestPasswordResetAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ForgotPasswordPage() {
  const [state, action, pending] = React.useActionState(
    requestPasswordResetAction,
    null
  );

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">Forgot your password?</CardTitle>
        <CardDescription>
          Enter your email <span className="whitespace-nowrap">or the fundraiser
          code</span> from your ID card. We&apos;ll email you a link to choose a
          new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.ok ? (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border bg-muted/40 p-4">
              <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
              <p className="text-sm">{state.message}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              The link expires in 1 hour and can only be used once.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form action={action} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="identifier">Email or fundraiser code</Label>
              <Input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                placeholder="you@example.com  or  YWD-XXXXXX"
              />
              <p className="text-xs text-muted-foreground">
                Fundraisers can use the code printed on their ID card.
              </p>
            </div>

            {state && !state.ok && (
              <p role="alert" className="text-sm text-destructive">
                {state.message}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={pending}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Remembered it?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Forgotten which email you used?{" "}
          <Link href="/support/contact" className="font-medium text-primary hover:underline">
            Contact support
          </Link>{" "}
          — we can help you recover the account.
        </p>
      </CardContent>
    </Card>
  );
}

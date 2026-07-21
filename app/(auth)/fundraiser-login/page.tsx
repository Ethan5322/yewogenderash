"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, IdCard } from "lucide-react";
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

function FundraiserLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("fundraiser-code", {
      code: String(form.get("code") ?? "").trim().toUpperCase(),
      password: String(form.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError("That verification code and password don't match a fundraiser account.");
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <IdCard className="h-5 w-5" aria-hidden />
        </div>
        <CardTitle className="text-2xl">Fundraiser sign-in</CardTitle>
        <CardDescription>
          Sign in with the verification code on your Fundraiser ID and the
          password you set when you registered.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="code">Verification code</Label>
            <Input
              id="code"
              name="code"
              autoComplete="username"
              placeholder="YWD-XXXXXX"
              className="font-mono uppercase"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Sign in
          </Button>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Prefer email?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Sign in with email
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function FundraiserLoginPage() {
  return (
    <React.Suspense>
      <FundraiserLoginForm />
    </React.Suspense>
  );
}

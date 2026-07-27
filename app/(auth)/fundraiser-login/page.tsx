"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FaceScan } from "@/components/auth/face-scan";
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
  const [faceDescriptor, setFaceDescriptor] = React.useState<number[] | null>(null);
  // Mirrored into the face-scan header so the fundraiser can see which ID they
  // are signing in with. Only the code they typed is echoed — never a name,
  // which would confirm the code exists before they have authenticated.
  const [code, setCode] = React.useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(e.currentTarget);
    const res = await signIn("fundraiser-code", {
      code: String(form.get("code") ?? "").trim().toUpperCase(),
      password: String(form.get("password") ?? ""),
      faceDescriptor: faceDescriptor ? JSON.stringify(faceDescriptor) : "",
      redirect: false,
    });
    setPending(false);
    if (res?.error) {
      setError(
        "Sign-in failed. Check your verification code, then either scan the face you registered with or enter your password."
      );
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
          Enter the verification code from your Fundraiser ID, then sign in the
          way you prefer — a face scan or your password.
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
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
            />
          </div>
          {/* Then EITHER credential — whichever the fundraiser prefers. */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label>Face verification</Label>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                Option 1
              </span>
            </div>
            <FaceScan
              onDescriptor={setFaceDescriptor}
              personCode={code ? code.toUpperCase() : null}
            />
            <p className="text-xs text-muted-foreground">
              Scan the face you registered with — nothing else needed.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label htmlFor="password">Password</Label>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  Option 2
                </span>
              </div>
              <Link
                href="/forgot-password"
                className="text-xs font-medium text-primary hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
            />
            <p className="text-xs text-muted-foreground">
              The password you chose when you registered.
            </p>
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

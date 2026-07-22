"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, ShieldCheck, KeyRound } from "lucide-react";
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
import { requestAdminCodeAction, type AdminCodeResult } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [state, action, sending] = useActionState<AdminCodeResult | null, FormData>(
    requestAdminCodeAction,
    null
  );
  const [creds, setCreds] = React.useState({ email: "", password: "" });
  const [code, setCode] = React.useState("");
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const codeSent = state?.ok === true;

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await signIn("credentials", {
        email: creds.email,
        password: creds.password,
        code,
        redirect: false,
      });
      if (res?.error) {
        setError("Wrong or expired code. Request a new one.");
        setVerifying(false);
        return;
      }
      // Signed in — go to the control room. Keep the spinner up during the
      // navigation so the button never looks idle mid-transition.
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong signing in. Please try again.");
      setVerifying(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <span className="mb-1 inline-flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <ShieldCheck className="h-5 w-5" aria-hidden />
        </span>
        <CardTitle className="text-2xl">Admin control room</CardTitle>
        <CardDescription>
          Two-factor sign-in for platform administrators. This area is not linked
          from the public site.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!codeSent ? (
          <form action={action} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">Admin email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={creds.email}
                onChange={(e) => setCreds((c) => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                value={creds.password}
                onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
              />
            </div>
            {state && !state.ok ? (
              <p role="alert" className="text-sm text-destructive">
                {state.error}
              </p>
            ) : null}
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Send login code
            </Button>
          </form>
        ) : (
          <form onSubmit={verify} className="space-y-4">
            <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
              A one-time code was sent to{" "}
              <span className="font-medium text-foreground">{state.sentTo}</span>.
              Enter it below to finish signing in.
            </p>
            <div className="space-y-2">
              <Label htmlFor="code">6-digit code</Label>
              <Input
                id="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                autoFocus
              />
            </div>
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button
              type="submit"
              className="w-full"
              disabled={verifying || code.length !== 6}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <KeyRound className="h-4 w-4" aria-hidden />
              )}
              Verify &amp; sign in
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}

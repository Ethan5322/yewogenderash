"use client";

import * as React from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Loader2, ShieldCheck, KeyRound, ScanFace } from "lucide-react";
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
import { requestAdminCodeAction, type AdminCodeResult } from "./actions";

export default function AdminLoginPage() {
  const router = useRouter();
  const [state, action, sending] = useActionState<AdminCodeResult | null, FormData>(
    requestAdminCodeAction,
    null
  );
  const [mode, setMode] = React.useState<"staff" | "email">("staff");
  const [creds, setCreds] = React.useState({ email: "", password: "" });
  const [code, setCode] = React.useState("");
  const [staffCode, setStaffCode] = React.useState("");
  const [staffPassword, setStaffPassword] = React.useState("");
  const [faceDescriptor, setFaceDescriptor] = React.useState<number[] | null>(null);
  const [verifying, setVerifying] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const codeSent = state?.ok === true;

  /** Staff code + EITHER a live face or the staff password. */
  async function signInWithStaffCode(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    setError(null);
    try {
      const res = await signIn("admin-code", {
        code: staffCode.trim().toUpperCase(),
        password: staffPassword,
        faceDescriptor: faceDescriptor ? JSON.stringify(faceDescriptor) : "",
        redirect: false,
      });
      if (res?.error) {
        setError(
          "Sign-in failed. Check your staff code, then either scan your enrolled face or enter your password."
        );
        setVerifying(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("Something went wrong signing in. Please try again.");
      setVerifying(false);
    }
  }

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
        {/* Two ways in: staff code + face (no email round-trip), or the
            classic email + password + emailed code. */}
        <div className="mb-4 grid grid-cols-2 gap-1 rounded-md bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => { setMode("staff"); setError(null); }}
            className={`rounded px-2 py-1.5 font-medium transition-colors ${
              mode === "staff" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Staff ID + face
          </button>
          <button
            type="button"
            onClick={() => { setMode("email"); setError(null); }}
            className={`rounded px-2 py-1.5 font-medium transition-colors ${
              mode === "email" ? "bg-background shadow-sm" : "text-muted-foreground"
            }`}
          >
            Email + code
          </button>
        </div>

        {mode === "staff" ? (
          <form onSubmit={signInWithStaffCode} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="staffCode">Staff verification code</Label>
              <Input
                id="staffCode"
                placeholder="YWD-ADM-XXXX"
                className="font-mono uppercase"
                autoComplete="username"
                value={staffCode}
                onChange={(e) => setStaffCode(e.target.value.toUpperCase())}
              />
            </div>

            {/* Then EITHER credential — whichever the admin prefers. */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <Label>Face verification</Label>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  Option 1
                </span>
              </div>
              <FaceScan
                onDescriptor={setFaceDescriptor}
                personCode={staffCode ? staffCode.toUpperCase() : null}
              />
              <p className="text-xs text-muted-foreground">
                Your enrolled face — no emailed code needed.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground">or</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="staffPassword">Password</Label>
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground">
                  Option 2
                </span>
              </div>
              <Input
                id="staffPassword"
                type="password"
                autoComplete="current-password"
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
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
              disabled={verifying || !staffCode || (!faceDescriptor && !staffPassword)}
            >
              {verifying ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanFace className="h-4 w-4" aria-hidden />
              )}
              Sign in
            </Button>
          </form>
        ) : !codeSent ? (
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

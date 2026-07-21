"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { CheckCircle2, Loader2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updatePhoneAction, type ActionResult } from "@/app/(public)/start/(wizard)/actions";

type Purpose = "EMAIL_VERIFY" | "PHONE_VERIFY";

function ChannelVerify({
  purpose,
  target,
  verified,
  icon,
  onVerified,
}: {
  purpose: Purpose;
  target: string;
  verified: boolean;
  icon: React.ReactNode;
  onVerified: () => void;
}) {
  const COOLDOWN = 30; // seconds — matches the server resend cooldown
  const [code, setCode] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Tick the resend countdown down to zero.
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function send() {
    if (cooldown > 0 || busy) return;
    setBusy(true);
    setError(null);
    setMsg(null);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setSent(true);
        setCooldown(COOLDOWN);
        setMsg(
          data.devCode
            ? `Dev code: ${data.devCode} (SMS/email isn't wired yet)`
            : "Code sent."
        );
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Could not send a code. Try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ purpose, code }),
      });
      if (res.ok) {
        onVerified();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Wrong or expired code.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{icon}</span>
          <span className="font-medium">{target}</span>
        </div>
        {verified ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden />
            Verified
          </span>
        ) : null}
      </div>

      {!verified ? (
        <div className="mt-3 space-y-3">
          {!sent ? (
            <Button type="button" size="sm" variant="outline" onClick={send} disabled={busy || cooldown > 0}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Send code"}
            </Button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="w-36"
              />
              <Button type="button" size="sm" onClick={verify} disabled={busy || code.length !== 6}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Verify
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={send} disabled={busy || cooldown > 0}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend"}
              </Button>
            </div>
          )}
          {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}

function PhoneForm({ initialPhone }: { initialPhone: string }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    updatePhoneAction,
    null
  );
  const router = useRouter();

  React.useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="rounded-lg border p-4">
      <label htmlFor="phone" className="text-sm font-medium">
        Add your phone number{" "}
        <span className="text-muted-foreground">(we&apos;ll call to verify it)</span>
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Input
          id="phone"
          name="phone"
          defaultValue={initialPhone}
          placeholder="+27 82 123 4567"
          className="w-52"
        />
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save number
        </Button>
      </div>
      {state && !state.ok ? (
        <p className="mt-2 text-sm text-destructive">{state.error}</p>
      ) : null}
    </form>
  );
}

export function OtpVerifyPanel({
  email,
  phone,
  emailVerified,
}: {
  email: string;
  phone: string | null;
  emailVerified: boolean;
}) {
  const router = useRouter();
  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      {/* Email — verified by an emailed OTP code. */}
      <ChannelVerify
        purpose="EMAIL_VERIFY"
        target={email}
        verified={emailVerified}
        icon={<Mail className="h-4 w-4" aria-hidden />}
        onVerified={refresh}
      />

      {/* Phone — collected here, verified by the admin's call (no OTP). */}
      {phone ? (
        <div className="rounded-lg border p-4">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground" aria-hidden />
            <span className="font-medium">{phone}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            An administrator will call this number to verify your identity during
            review — no code needed here.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-medium text-primary">
              Change number
            </summary>
            <div className="mt-2">
              <PhoneForm initialPhone={phone} />
            </div>
          </details>
        </div>
      ) : (
        <PhoneForm initialPhone="" />
      )}
    </div>
  );
}

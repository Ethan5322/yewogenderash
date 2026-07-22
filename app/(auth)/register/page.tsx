"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldCheck } from "lucide-react";
import { registerSchema, type RegisterInput } from "@/lib/validators/auth";
import { useDict } from "@/lib/use-dict";
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

/** Only allow same-site relative redirects (no open-redirect via ?next=). */
function safeNext(next: string | null): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next;
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useDict().register;
  const next = safeNext(searchParams.get("next"));
  // Registering to become a campaign owner (came from /start) → continue
  // straight into the verification wizard, and require a phone (it must be
  // OTP-verified in the very next step).
  const isFundraiser = !!next && next.startsWith("/start");

  const [serverError, setServerError] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterInput) {
    setServerError(null);
    // Fundraisers must supply a phone — it's verified by OTP in the next step.
    if (isFundraiser && !values.phone?.trim()) {
      setServerError(t.phoneRequired);
      return;
    }

    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...values, website: honeypot }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setServerError(data?.error ?? t.genericError);
      return;
    }

    const login = await signIn("credentials", {
      email: values.email,
      password: values.password,
      redirect: false,
    });
    if (login?.error) {
      router.push(next ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login");
      return;
    }
    // Full-page navigation (not router.push) so the freshly-set session cookie
    // is fully committed before the next page's authenticated fetches run —
    // otherwise the first request (e.g. Send OTP) can race and 401.
    window.location.assign(next ?? "/");
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">
          {isFundraiser ? t.ownerTitle : t.donorTitle}
        </CardTitle>
        <CardDescription>
          {isFundraiser ? t.ownerDesc : t.donorDesc}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          {/* Honeypot: hidden from humans, catnip for bots. Never fill it. */}
          <div className="hidden" aria-hidden>
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={honeypot}
              onChange={(e) => setHoneypot(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">{t.name}</Label>
            <Input id="name" autoComplete="name" {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t.emailPlaceholder}
              {...register("email")}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone">
              {t.phone}{" "}
              {isFundraiser ? (
                <span className="text-destructive">*</span>
              ) : (
                <span className="text-muted-foreground">{t.optional}</span>
              )}
            </Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              placeholder={t.phonePlaceholder}
              {...register("phone")}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">{t.password}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              {...register("password")}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p role="alert" className="text-sm text-destructive">
              {serverError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isFundraiser ? t.createContinue : t.create}
          </Button>
        </form>

        {isFundraiser ? (
          <p className="mt-4 flex items-start gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
            {t.ownerNote}
          </p>
        ) : null}

        <p className="mt-4 text-center text-sm text-muted-foreground">
          {t.haveAccount}{" "}
          <Link
            href={next ? `/login?callbackUrl=${encodeURIComponent(next)}` : "/login"}
            className="font-medium text-primary hover:underline"
          >
            {t.signIn}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

export default function RegisterPage() {
  return (
    <React.Suspense>
      <RegisterForm />
    </React.Suspense>
  );
}

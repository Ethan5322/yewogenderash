import "server-only";

/**
 * Typed access to required server environment variables.
 * Fails loudly with the variable name instead of a vague runtime error.
 * Optional integrations (WhatsApp admin alerts) use `optionalEnv`.
 */
export function requiredEnv(
  name:
    | "DATABASE_URL"
    | "DIRECT_URL"
    | "NEXT_PUBLIC_SUPABASE_URL"
    | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    | "SUPABASE_SERVICE_ROLE_KEY"
    | "AUTH_SECRET"
    | "CHAPA_SECRET_KEY"
    | "CHAPA_WEBHOOK_SECRET"
    | "NEXT_PUBLIC_APP_URL"
): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. ` +
        `Copy .env.example to .env.local and fill it in.`
    );
  }
  return value;
}

export function optionalEnv(
  name: "ADMIN_WHATSAPP_PHONE" | "ADMIN_CALLMEBOT_APIKEY"
): string | undefined {
  return process.env[name] || undefined;
}

/** Absolute site URL without a trailing slash (for callbacks, QR targets). */
export function appUrl(): string {
  return requiredEnv("NEXT_PUBLIC_APP_URL").replace(/\/+$/, "");
}

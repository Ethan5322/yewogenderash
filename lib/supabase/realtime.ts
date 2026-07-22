"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser-side Supabase client for Realtime ONLY (anon key — safe to expose).
 * Used to broadcast/receive the "phone capture done" signal between the
 * fundraiser's laptop and their phone over an ephemeral channel keyed by the
 * capture token. No database rows or RLS involved — pure pub/sub.
 */
let cached: SupabaseClient | null = null;

export function realtimeClient(): SupabaseClient {
  if (!cached) {
    cached = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false }, realtime: { params: { eventsPerSecond: 2 } } }
    );
  }
  return cached;
}

export const captureChannelName = (token: string) => `capture:${token.slice(0, 40)}`;

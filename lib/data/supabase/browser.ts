"use client";

import { createBrowserClient } from "@supabase/ssr";

import { publicEnv, supabasePublishableKey } from "@/lib/config/public-env";

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey
  );
}

import "server-only";

import { createClient } from "@supabase/supabase-js";

import { env, requireEnv, supabaseSecretKey } from "@/lib/config/env";

export function createSupabaseServiceClient() {
  return createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    requireEnv(supabaseSecretKey, "SUPABASE_SECRET_KEY"),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
}

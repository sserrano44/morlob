import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env, supabasePublishableKey } from "@/lib/config/env";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server components cannot set cookies; route handlers can.
          }
        }
      }
    }
  );
}

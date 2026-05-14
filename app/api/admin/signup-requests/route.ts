import { NextResponse } from "next/server";

import { requireHumanActor } from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export async function GET() {
  return withApi(async () => {
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    await requirePlatformAdmin(supabase, actor.user);

    const { data, error } = await supabase
      .from("user_access")
      .select(
        "id, public_id, user_id, email, status, is_platform_admin, created_at, updated_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ requests: data ?? [] });
  });
}

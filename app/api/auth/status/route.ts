import { NextResponse } from "next/server";

import { requireHumanActor } from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { ensureUserAccess } from "@/lib/auth/access";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export async function GET() {
  return withApi(async () => {
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const access = await ensureUserAccess(supabase, actor.user);

    return NextResponse.json({
      access: {
        status: access.status,
        is_platform_admin: access.is_platform_admin
      }
    });
  });
}

import { NextResponse } from "next/server";
import { z } from "zod";

import { requireHumanActor } from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { requirePlatformAdmin } from "@/lib/auth/access";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

type Params = { requestId: string };

const updateSchema = z.object({
  status: z.enum(["approved", "rejected"])
});

export async function PATCH(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { requestId } = await routeParams(context);
    const input = updateSchema.parse(await request.json());
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    await requirePlatformAdmin(supabase, actor.user);
    const now = new Date().toISOString();

    const { data: access, error } = await supabase
      .from("user_access")
      .update({
        status: input.status,
        approved_by: input.status === "approved" ? actor.user.id : null,
        approved_at: input.status === "approved" ? now : null,
        rejected_by: input.status === "rejected" ? actor.user.id : null,
        rejected_at: input.status === "rejected" ? now : null
      })
      .eq("public_id", requestId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!access) {
      throw new ApiError("not_found", "Signup request not found.");
    }

    return NextResponse.json({ access });
  });
}

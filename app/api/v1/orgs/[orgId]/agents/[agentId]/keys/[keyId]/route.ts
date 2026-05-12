import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

type Params = { orgId: string; agentId: string; keyId: string };

export async function DELETE(_request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId, keyId } = await routeParams(context);
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id")
      .eq("organization_id", organization.id)
      .eq("public_id", agentId)
      .maybeSingle<{ id: string }>();

    if (agentError) {
      throw agentError;
    }

    if (!agent) {
      throw new ApiError("not_found", "Agent not found.");
    }

    const { data: key, error } = await supabase
      .from("agent_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("organization_id", organization.id)
      .eq("agent_id", agent.id)
      .eq("public_id", keyId)
      .is("revoked_at", null)
      .select("id, public_id")
      .maybeSingle<{ id: string; public_id: string }>();

    if (error) {
      throw error;
    }

    if (!key) {
      throw new ApiError("not_found", "API key not found.");
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent_key.revoked",
      resourceType: "agent_api_key",
      resourceId: key.id
    });

    return NextResponse.json({ key });
  });
}

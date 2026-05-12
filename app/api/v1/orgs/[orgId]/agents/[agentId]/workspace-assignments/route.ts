import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createAssignmentSchema } from "@/lib/validation/schemas";

type Params = { orgId: string; agentId: string };

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId } = await routeParams(context);
    const input = createAssignmentSchema.parse(await request.json());
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
      .select("id, public_id")
      .eq("organization_id", organization.id)
      .eq("public_id", agentId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; public_id: string }>();

    if (agentError) {
      throw agentError;
    }

    if (!agent) {
      throw new ApiError("not_found", "Agent not found.");
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, public_id")
      .eq("organization_id", organization.id)
      .eq("public_id", input.workspace_id)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; public_id: string }>();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspace) {
      throw new ApiError("not_found", "Workspace not found.");
    }

    const { data: assignment, error } = await supabase
      .from("agent_workspace_assignments")
      .upsert(
        {
          organization_id: organization.id,
          agent_id: agent.id,
          workspace_id: workspace.id,
          revoked_at: null
        },
        { onConflict: "agent_id,workspace_id" }
      )
      .select("id, public_id, agent_id, workspace_id, revoked_at, created_at")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent.assigned_to_workspace",
      resourceType: "agent_workspace_assignment",
      resourceId: assignment.id,
      metadata: {
        agent_id: agent.public_id,
        workspace_id: workspace.public_id
      }
    });

    return NextResponse.json({ assignment }, { status: 201 });
  });
}

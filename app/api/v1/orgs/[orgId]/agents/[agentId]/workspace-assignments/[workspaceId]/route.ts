import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

type Params = { orgId: string; agentId: string; workspaceId: string };

export async function DELETE(_request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId, workspaceId } = await routeParams(context);
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
      .eq("public_id", workspaceId)
      .maybeSingle<{ id: string; public_id: string }>();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspace) {
      throw new ApiError("not_found", "Workspace not found.");
    }

    const { data: assignment, error } = await supabase
      .from("agent_workspace_assignments")
      .update({ revoked_at: new Date().toISOString() })
      .eq("agent_id", agent.id)
      .eq("workspace_id", workspace.id)
      .is("revoked_at", null)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw error;
    }

    if (!assignment) {
      throw new ApiError("not_found", "Assignment not found.");
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent.unassigned_from_workspace",
      resourceType: "agent_workspace_assignment",
      resourceId: assignment.id
    });

    return NextResponse.json({ assignment });
  });
}

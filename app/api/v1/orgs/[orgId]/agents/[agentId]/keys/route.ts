import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { env } from "@/lib/config/env";
import { generateApiKey } from "@/lib/core/api-keys";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createAgentKeySchema } from "@/lib/validation/schemas";

type Params = { orgId: string; agentId: string };
type KeyWorkspace = {
  id: string;
  public_id: string;
  name: string;
  slug: string;
  status: string;
};

async function resolveWorkspaceForKey(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  organizationId: string,
  workspacePublicId?: string
) {
  let query = supabase
    .from("workspaces")
    .select("id, public_id, name, slug, status")
    .eq("organization_id", organizationId)
    .eq("status", "active")
    .is("deleted_at", null);

  if (workspacePublicId) {
    query = query.eq("public_id", workspacePublicId);
  }

  const { data, error } = await query
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle<KeyWorkspace>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ApiError(
      "validation_error",
      workspacePublicId
        ? "Selected workspace was not found or is not active."
        : "Create an active workspace before creating an agent key."
    );
  }

  return data;
}

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId } = await routeParams(context);
    const actor = await requireHumanActor();
    const input = createAgentKeySchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, public_id, status")
      .eq("organization_id", organization.id)
      .eq("public_id", agentId)
      .is("deleted_at", null)
      .maybeSingle<{ id: string; public_id: string; status: string }>();

    if (agentError) {
      throw agentError;
    }

    if (!agent) {
      throw new ApiError("not_found", "Agent not found.");
    }

    const workspace = await resolveWorkspaceForKey(
      supabase,
      organization.id,
      input.workspace_id
    );
    const { data: assignment, error: assignmentError } = await supabase
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

    if (assignmentError) {
      throw assignmentError;
    }

    const generated = generateApiKey(env.API_KEY_PREFIX);
    const { data: key, error } = await supabase
      .from("agent_api_keys")
      .insert({
        organization_id: organization.id,
        agent_id: agent.id,
        name: input.name,
        key_prefix: generated.keyPrefix,
        key_hash: generated.hash,
        hash_salt: generated.salt,
        scopes: input.scopes
      })
      .select("id, public_id, name, key_prefix, scopes, created_at")
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
        workspace_id: workspace.public_id,
        source: "agent_key_creation"
      }
    });

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent_key.created",
      resourceType: "agent_api_key",
      resourceId: key.id,
      metadata: {
        agent_id: agent.public_id,
        workspace_id: workspace.public_id,
        scopes: input.scopes
      }
    });

    return NextResponse.json(
      {
        key,
        workspace,
        assignment,
        secret: generated.plaintext
      },
      { status: 201 }
    );
  });
}

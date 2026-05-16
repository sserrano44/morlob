import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { listAgentsWithWorkspaceAssignments } from "@/lib/core/agents";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { updateAgentSchema } from "@/lib/validation/schemas";

type Params = { orgId: string; agentId: string };

async function requireAgent(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  organizationId: string,
  agentPublicId: string
) {
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, public_id, name, kind, status, metadata, created_at")
    .eq("organization_id", organizationId)
    .eq("public_id", agentPublicId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      public_id: string;
      name: string;
      kind: string;
      status: string;
      metadata: Record<string, unknown>;
      created_at: string;
    }>();

  if (error) {
    throw error;
  }

  if (!agent) {
    throw new ApiError("not_found", "Agent not found.");
  }

  return agent;
}

export async function GET(_request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId } = await routeParams(context);
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id
    );
    const agents = await listAgentsWithWorkspaceAssignments(supabase, organization.id);
    const agent = agents.find((item) => item.public_id === agentId);

    if (!agent) {
      throw new ApiError("not_found", "Agent not found.");
    }

    return NextResponse.json({ agent });
  });
}

export async function PATCH(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId } = await routeParams(context);
    const input = updateAgentSchema.parse(await request.json());
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );
    const existing = await requireAgent(supabase, organization.id, agentId);

    const update = {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.kind !== undefined ? { kind: input.kind } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
    };

    const { data: agent, error } = await supabase
      .from("agents")
      .update(update)
      .eq("id", existing.id)
      .select("id, public_id, name, kind, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent.updated",
      resourceType: "agent",
      resourceId: existing.id,
      metadata: {
        before: {
          name: existing.name,
          kind: existing.kind,
          status: existing.status
        },
        after: {
          name: agent.name,
          kind: agent.kind,
          status: agent.status
        }
      }
    });

    return NextResponse.json({ agent });
  });
}

export async function DELETE(_request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, agentId } = await routeParams(context);
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );
    const existing = await requireAgent(supabase, organization.id, agentId);
    const revokedAt = new Date().toISOString();

    const { data: agent, error } = await supabase
      .from("agents")
      .update({ deleted_at: revokedAt, status: "archived" })
      .eq("id", existing.id)
      .select("id, public_id, name, kind, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    await Promise.all([
      supabase
        .from("agent_api_keys")
        .update({ revoked_at: revokedAt })
        .eq("agent_id", existing.id)
        .is("revoked_at", null),
      supabase
        .from("agent_workspace_assignments")
        .update({ revoked_at: revokedAt })
        .eq("agent_id", existing.id)
        .is("revoked_at", null)
    ]);

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent.deleted",
      resourceType: "agent",
      resourceId: existing.id
    });

    return NextResponse.json({ agent });
  });
}

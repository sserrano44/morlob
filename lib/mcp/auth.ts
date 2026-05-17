import { authenticateAgent, getBearerToken } from "@/lib/api/auth";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { hasScope } from "@/lib/core/permissions";
import { mcpResourceUrl, requestOrigin } from "@/lib/oauth/config";
import { validateOAuthAccessToken } from "@/lib/oauth/tokens";

export type McpActor =
  | {
      type: "oauth";
      actorType: "human";
      actorId: string;
      organizationId: string;
      organizationPublicId: string;
      workspaceId: string;
      workspacePublicId: string;
      scopes: string[];
      clientId: string;
    }
  | {
      type: "agent";
      actorType: "agent";
      actorId: string;
      organizationId: string;
      organizationPublicId: string;
      workspaceId: string;
      workspacePublicId: string;
      scopes: string[];
      agentPublicId: string;
    };

type AgentAssignment = {
  workspace_id: string;
  workspaces:
    | {
        id: string;
        public_id: string;
        status: string;
      }
    | {
        id: string;
        public_id: string;
        status: string;
      }[]
    | null;
};

export async function authenticateMcpRequest(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return null;
  }

  const supabase = createSupabaseServiceClient();

  if (token.startsWith("moa_")) {
    const actor = await validateOAuthAccessToken(
      supabase,
      token,
      mcpResourceUrl(requestOrigin(request))
    );

    if (!actor) {
      return null;
    }

    return {
      type: "oauth" as const,
      actorType: "human" as const,
      actorId: actor.userId,
      organizationId: actor.organizationId,
      organizationPublicId: actor.organizationPublicId,
      workspaceId: actor.workspaceId,
      workspacePublicId: actor.workspacePublicId,
      scopes: actor.scopes,
      clientId: actor.clientId
    };
  }

  try {
    const agentActor = await authenticateAgent(request);
    const { data: assignment, error } = await supabase
      .from("agent_workspace_assignments")
      .select("workspace_id, workspaces(id, public_id, status)")
      .eq("agent_id", agentActor.agent.id)
      .is("revoked_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle<AgentAssignment>();

    if (error) {
      throw error;
    }

    const workspace = Array.isArray(assignment?.workspaces)
      ? assignment?.workspaces[0]
      : assignment?.workspaces;

    if (!assignment || !workspace || workspace.status !== "active") {
      return null;
    }

    return {
      type: "agent" as const,
      actorType: "agent" as const,
      actorId: agentActor.agent.id,
      organizationId: agentActor.organization.id,
      organizationPublicId: agentActor.organization.public_id,
      workspaceId: assignment.workspace_id,
      workspacePublicId: workspace.public_id,
      scopes: agentActor.key.scopes,
      agentPublicId: agentActor.agent.public_id
    };
  } catch {
    return null;
  }
}

export function requireMcpScope(actor: McpActor, scope: string) {
  if (!hasScope(actor.scopes, scope)) {
    throw new Error(`MCP scope required: ${scope}`);
  }
}

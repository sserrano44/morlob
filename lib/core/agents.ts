import type { SupabaseClient } from "@supabase/supabase-js";

export type AgentWorkspaceSummary = {
  public_id: string;
  name: string;
  slug: string;
  status: string;
};

export type AgentWorkspaceAssignmentSummary = {
  public_id: string;
  workspace: AgentWorkspaceSummary;
  revoked_at: string | null;
  created_at: string;
};

export type AgentWithWorkspaceAssignments = {
  id: string;
  public_id: string;
  name: string;
  kind: string;
  status: string;
  created_at: string;
  workspace_assignments: AgentWorkspaceAssignmentSummary[];
};

type DbAgent = Omit<AgentWithWorkspaceAssignments, "workspace_assignments">;

type DbAssignment = {
  public_id: string;
  agent_id: string;
  revoked_at: string | null;
  created_at: string;
  workspaces: AgentWorkspaceSummary | AgentWorkspaceSummary[] | null;
};

export async function listAgentsWithWorkspaceAssignments(
  supabase: SupabaseClient,
  organizationId: string
) {
  const [{ data: agents, error: agentsError }, { data: assignments, error: assignmentsError }] =
    await Promise.all([
      supabase
        .from("agents")
        .select("id, public_id, name, kind, status, created_at")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      supabase
        .from("agent_workspace_assignments")
        .select(
          "public_id, agent_id, revoked_at, created_at, workspaces(public_id, name, slug, status)"
        )
        .eq("organization_id", organizationId)
        .is("revoked_at", null)
        .order("created_at", { ascending: true })
    ]);

  if (agentsError) {
    throw agentsError;
  }

  if (assignmentsError) {
    throw assignmentsError;
  }

  const assignmentsByAgent = new Map<string, AgentWorkspaceAssignmentSummary[]>();

  for (const assignment of (assignments ?? []) as DbAssignment[]) {
    const workspace = Array.isArray(assignment.workspaces)
      ? assignment.workspaces[0]
      : assignment.workspaces;

    if (!workspace) {
      continue;
    }

    const current = assignmentsByAgent.get(assignment.agent_id) ?? [];
    current.push({
      public_id: assignment.public_id,
      workspace,
      revoked_at: assignment.revoked_at,
      created_at: assignment.created_at
    });
    assignmentsByAgent.set(assignment.agent_id, current);
  }

  return ((agents ?? []) as DbAgent[]).map((agent) => ({
    ...agent,
    workspace_assignments: assignmentsByAgent.get(agent.id) ?? []
  }));
}

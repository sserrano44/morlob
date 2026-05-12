export type KeyState = {
  revoked_at?: string | null;
  expires_at?: string | null;
};

export type AgentState = {
  status: "active" | "disabled" | "archived";
};

export function hasScope(grantedScopes: readonly string[], requiredScope: string) {
  return grantedScopes.includes("*") || grantedScopes.includes(requiredScope);
}

export function keyIsUsable(key: KeyState, now = new Date()) {
  if (key.revoked_at) {
    return false;
  }

  if (key.expires_at && new Date(key.expires_at).getTime() <= now.getTime()) {
    return false;
  }

  return true;
}

export function agentIsUsable(agent: AgentState) {
  return agent.status === "active";
}

export function hasWorkspaceAssignment(
  assignments: readonly { workspace_id: string; revoked_at?: string | null }[],
  workspaceId: string
) {
  return assignments.some(
    (assignment) =>
      assignment.workspace_id === workspaceId && assignment.revoked_at === null
  );
}

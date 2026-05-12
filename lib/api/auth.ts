import type { SupabaseClient, User } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import { env } from "@/lib/config/env";
import { parseApiKey, verifyApiKey } from "@/lib/core/api-keys";
import {
  agentIsUsable,
  hasScope,
  keyIsUsable
} from "@/lib/core/permissions";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export type HumanActor = {
  type: "human";
  user: User;
};

export type AgentActor = {
  type: "agent";
  organization: DbOrganization;
  workspace?: DbWorkspace;
  agent: DbAgent;
  key: DbAgentKey;
};

export type DbOrganization = {
  id: string;
  public_id: string;
  name: string;
  slug: string;
  status: "active" | "disabled" | "archived";
};

export type DbWorkspace = {
  id: string;
  public_id: string;
  organization_id: string;
  name: string;
  slug: string;
  status: "active" | "disabled" | "archived";
};

export type DbAgent = {
  id: string;
  public_id: string;
  organization_id: string;
  name: string;
  kind: string;
  status: "active" | "disabled" | "archived";
};

export type DbAgentKey = {
  id: string;
  public_id: string;
  organization_id: string;
  agent_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  hash_salt: string;
  scopes: string[];
  revoked_at: string | null;
  expires_at: string | null;
};

export async function requireHumanActor(): Promise<HumanActor> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("unauthorized", "Authentication is required.");
  }

  return { type: "human", user };
}

export async function requireOrganizationForHuman(
  supabase: SupabaseClient,
  orgPublicId: string,
  userId: string,
  allowedRoles?: readonly string[]
) {
  const { data: organization, error: orgError } = await supabase
    .from("organizations")
    .select("id, public_id, name, slug, status")
    .eq("public_id", orgPublicId)
    .is("deleted_at", null)
    .maybeSingle<DbOrganization>();

  if (orgError) {
    throw orgError;
  }

  if (!organization) {
    throw new ApiError("not_found", "Organization not found.");
  }

  if (organization.status !== "active") {
    throw new ApiError("forbidden", "Organization is not active.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("role")
    .eq("organization_id", organization.id)
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new ApiError("forbidden", "You do not belong to this organization.");
  }

  if (allowedRoles && !allowedRoles.includes(membership.role)) {
    throw new ApiError("forbidden", "Insufficient organization role.");
  }

  return { organization, membership };
}

export async function requireWorkspaceForHuman(
  supabase: SupabaseClient,
  organizationId: string,
  workspacePublicId: string,
  userId: string
) {
  const { data: workspace, error } = await supabase
    .from("workspaces")
    .select("id, public_id, organization_id, name, slug, status")
    .eq("organization_id", organizationId)
    .eq("public_id", workspacePublicId)
    .is("deleted_at", null)
    .maybeSingle<DbWorkspace>();

  if (error) {
    throw error;
  }

  if (!workspace) {
    throw new ApiError("not_found", "Workspace not found.");
  }

  if (workspace.status !== "active") {
    throw new ApiError("forbidden", "Workspace is not active.");
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("role")
    .eq("workspace_id", workspace.id)
    .eq("user_id", userId)
    .maybeSingle<{ role: string }>();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    throw new ApiError("forbidden", "You do not belong to this workspace.");
  }

  return { workspace, membership };
}

export function getBearerToken(request: Request) {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  return header.slice("Bearer ".length).trim();
}

export async function authenticateAgent(
  request: Request,
  options: {
    requiredScope?: string;
    orgPublicId?: string;
    workspacePublicId?: string;
  } = {}
): Promise<AgentActor> {
  const token = getBearerToken(request);

  if (!token) {
    throw new ApiError("unauthorized", "Bearer API key is required.");
  }

  const parsed = parseApiKey(token, env.API_KEY_PREFIX);

  if (!parsed) {
    throw new ApiError("unauthorized", "Invalid API key.");
  }

  const supabase = createSupabaseServiceClient();
  const { data: key, error: keyError } = await supabase
    .from("agent_api_keys")
    .select(
      "id, public_id, organization_id, agent_id, name, key_prefix, key_hash, hash_salt, scopes, revoked_at, expires_at"
    )
    .eq("key_prefix", parsed.keyPrefix)
    .maybeSingle<DbAgentKey>();

  if (keyError) {
    throw keyError;
  }

  if (!key || !verifyApiKey(token, key.hash_salt, key.key_hash)) {
    throw new ApiError("unauthorized", "Invalid API key.");
  }

  if (!keyIsUsable(key)) {
    throw new ApiError("unauthorized", "API key is revoked or expired.");
  }

  if (options.requiredScope && !hasScope(key.scopes, options.requiredScope)) {
    throw new ApiError("scope_required", `Scope required: ${options.requiredScope}`);
  }

  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, public_id, organization_id, name, kind, status")
    .eq("id", key.agent_id)
    .is("deleted_at", null)
    .maybeSingle<DbAgent>();

  if (agentError) {
    throw agentError;
  }

  if (!agent || !agentIsUsable(agent)) {
    throw new ApiError("forbidden", "Agent is disabled or archived.");
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("id, public_id, name, slug, status")
    .eq("id", key.organization_id)
    .is("deleted_at", null)
    .maybeSingle<DbOrganization>();

  if (organizationError) {
    throw organizationError;
  }

  if (!organization || organization.status !== "active") {
    throw new ApiError("forbidden", "Organization is not active.");
  }

  if (options.orgPublicId && organization.public_id !== options.orgPublicId) {
    throw new ApiError("forbidden", "API key does not belong to this organization.");
  }

  let workspace: DbWorkspace | undefined;

  if (options.workspacePublicId) {
    const { data: workspaceData, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, public_id, organization_id, name, slug, status")
      .eq("organization_id", organization.id)
      .eq("public_id", options.workspacePublicId)
      .is("deleted_at", null)
      .maybeSingle<DbWorkspace>();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspaceData) {
      throw new ApiError("not_found", "Workspace not found.");
    }

    if (workspaceData.status !== "active") {
      throw new ApiError("forbidden", "Workspace is not active.");
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("agent_workspace_assignments")
      .select("id")
      .eq("agent_id", agent.id)
      .eq("workspace_id", workspaceData.id)
      .is("revoked_at", null)
      .maybeSingle<{ id: string }>();

    if (assignmentError) {
      throw assignmentError;
    }

    if (!assignment) {
      throw new ApiError(
        "workspace_not_assigned",
        "Agent is not assigned to this workspace."
      );
    }

    workspace = workspaceData;
  }

  await supabase
    .from("agent_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id);

  return { type: "agent", organization, workspace, agent, key };
}

export async function getRequestActor(
  request: Request,
  options: {
    requiredAgentScope?: string;
    orgPublicId?: string;
    workspacePublicId?: string;
  }
) {
  if (getBearerToken(request)) {
    return authenticateAgent(request, {
      requiredScope: options.requiredAgentScope,
      orgPublicId: options.orgPublicId,
      workspacePublicId: options.workspacePublicId
    });
  }

  return requireHumanActor();
}

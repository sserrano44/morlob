import type { SupabaseClient, User } from "@supabase/supabase-js";

import {
  authenticateAgent,
  requireHumanActor,
  requireOrganizationForHuman,
  requireWorkspaceForHuman,
  type DbOrganization,
  type DbWorkspace
} from "@/lib/api/auth";

export type WorkspaceActor =
  | {
      type: "human";
      user: User;
    }
  | {
      type: "agent";
      agent: {
        id: string;
        public_id: string;
        name: string;
      };
      key: {
        id: string;
        scopes: string[];
      };
    };

export type WorkspaceContext = {
  actor: WorkspaceActor;
  organization: DbOrganization;
  workspace: DbWorkspace;
};

export async function requireWorkspaceContext(
  request: Request,
  supabase: SupabaseClient,
  input: {
    orgPublicId: string;
    workspacePublicId: string;
    requiredAgentScope: string;
  }
): Promise<WorkspaceContext> {
  if (request.headers.get("authorization")?.startsWith("Bearer ")) {
    const agentActor = await authenticateAgent(request, {
      requiredScope: input.requiredAgentScope,
      orgPublicId: input.orgPublicId,
      workspacePublicId: input.workspacePublicId
    });

    if (!agentActor.workspace) {
      throw new Error("Workspace context was not resolved for agent.");
    }

    return {
      actor: {
        type: "agent",
        agent: {
          id: agentActor.agent.id,
          public_id: agentActor.agent.public_id,
          name: agentActor.agent.name
        },
        key: {
          id: agentActor.key.id,
          scopes: agentActor.key.scopes
        }
      },
      organization: agentActor.organization,
      workspace: agentActor.workspace
    };
  }

  const humanActor = await requireHumanActor();
  const { organization } = await requireOrganizationForHuman(
    supabase,
    input.orgPublicId,
    humanActor.user.id
  );
  const { workspace } = await requireWorkspaceForHuman(
    supabase,
    organization.id,
    input.workspacePublicId,
    humanActor.user.id
  );

  return {
    actor: humanActor,
    organization,
    workspace
  };
}

export function actorDbFields(actor: WorkspaceActor) {
  if (actor.type === "agent") {
    return {
      actorType: "agent" as const,
      actorId: actor.agent.id
    };
  }

  return {
    actorType: "human" as const,
    actorId: actor.user.id
  };
}

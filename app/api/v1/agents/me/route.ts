import { NextResponse } from "next/server";

import { authenticateAgent } from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export async function GET(request: Request) {
  return withApi(async () => {
    const actor = await authenticateAgent(request);
    const supabase = createSupabaseServiceClient();
    const { data: assignments, error } = await supabase
      .from("agent_workspace_assignments")
      .select("workspaces(public_id, name, slug, status)")
      .eq("agent_id", actor.agent.id)
      .is("revoked_at", null);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      agent: {
        id: actor.agent.public_id,
        name: actor.agent.name,
        kind: actor.agent.kind,
        status: actor.agent.status,
        organization_id: actor.organization.public_id,
        scopes: actor.key.scopes
      },
      workspaces:
        assignments?.map((row) =>
          Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
        ) ?? []
    });
  });
}

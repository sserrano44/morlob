import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createAgentSchema } from "@/lib/validation/schemas";

type Params = { orgId: string };

export async function GET(_request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId } = await routeParams(context);
    const actor = await requireHumanActor();
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id
    );

    const { data, error } = await supabase
      .from("agents")
      .select("id, public_id, name, kind, status, created_at")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ agents: data ?? [] });
  });
}

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId } = await routeParams(context);
    const actor = await requireHumanActor();
    const input = createAgentSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );

    const { data: agent, error } = await supabase
      .from("agents")
      .insert({
        organization_id: organization.id,
        name: input.name,
        kind: input.kind,
        metadata: input.metadata
      })
      .select("id, public_id, organization_id, name, kind, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "agent.created",
      resourceType: "agent",
      resourceId: agent.id
    });

    return NextResponse.json({ agent }, { status: 201 });
  });
}

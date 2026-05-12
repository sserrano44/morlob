import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import {
  requireHumanActor,
  requireOrganizationForHuman
} from "@/lib/api/auth";
import { withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import { slugify } from "@/lib/core/ids";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createWorkspaceSchema } from "@/lib/validation/schemas";

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
      .from("workspaces")
      .select("id, public_id, name, slug, status, created_at")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ workspaces: data ?? [] });
  });
}

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId } = await routeParams(context);
    const actor = await requireHumanActor();
    const input = createWorkspaceSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const { organization } = await requireOrganizationForHuman(
      supabase,
      orgId,
      actor.user.id,
      ["owner", "admin"]
    );

    const { data: workspace, error } = await supabase
      .from("workspaces")
      .insert({
        organization_id: organization.id,
        name: input.name,
        slug: `${slugify(input.name)}-${crypto.randomUUID().slice(0, 8)}`
      })
      .select("id, public_id, organization_id, name, slug, status, created_at")
      .single();

    if (error) {
      throw error;
    }

    const { error: membershipError } = await supabase
      .from("workspace_memberships")
      .insert({
        organization_id: organization.id,
        workspace_id: workspace.id,
        user_id: actor.user.id,
        role: "owner"
      });

    if (membershipError) {
      throw membershipError;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      actorType: "human",
      actorId: actor.user.id,
      action: "workspace.created",
      resourceType: "workspace",
      resourceId: workspace.id
    });

    return NextResponse.json({ workspace }, { status: 201 });
  });
}

import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { findWorkspaceFile } from "@/lib/api/files";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { withApi } from "@/lib/api/errors";
import { resolveLinkTarget } from "@/lib/core/resource-links";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createFileLinkSchema } from "@/lib/validation/schemas";

type Params = { orgId: string; workspaceId: string; fileId: string };

export async function GET(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:read"
    });
    const file = await findWorkspaceFile(
      supabase,
      workspaceContext.workspace.id,
      fileId
    );

    const { data, error } = await supabase
      .from("resource_links")
      .select(
        "id, public_id, source_resource_type, source_resource_id, target_resource_type, target_resource_id, relationship, created_at"
      )
      .eq("workspace_id", workspaceContext.workspace.id)
      .eq("source_resource_type", "file")
      .eq("source_resource_id", file.id)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ links: data ?? [] });
  });
}

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId } = await routeParams(context);
    const input = createFileLinkSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const file = await findWorkspaceFile(
      supabase,
      workspaceContext.workspace.id,
      fileId
    );
    const target = await resolveLinkTarget({
      supabase,
      workspaceId: workspaceContext.workspace.id,
      targetResourceType: input.target_resource_type,
      targetPublicId: input.target_resource_id
    });

    const { data: link, error } = await supabase
      .from("resource_links")
      .upsert(
        {
          organization_id: workspaceContext.organization.id,
          workspace_id: workspaceContext.workspace.id,
          source_resource_type: "file",
          source_resource_id: file.id,
          target_resource_type: input.target_resource_type,
          target_resource_id: target.id,
          relationship: input.relationship,
          created_by_type: actor.actorType,
          created_by_id: actor.actorId
        },
        {
          onConflict:
            "workspace_id,source_resource_type,source_resource_id,target_resource_type,target_resource_id,relationship"
        }
      )
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "file.linked",
      resourceType: "resource_link",
      resourceId: link.id,
      metadata: {
        file_id: file.public_id,
        target_resource_type: input.target_resource_type,
        target_resource_id: target.public_id,
        relationship: input.relationship
      }
    });

    return NextResponse.json({ link }, { status: 201 });
  });
}

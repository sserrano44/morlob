import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { withApi } from "@/lib/api/errors";
import { findWorkspaceFile } from "@/lib/api/files";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { updateFileSchema } from "@/lib/validation/schemas";

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

    return NextResponse.json({ file });
  });
}

export async function PATCH(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId } = await routeParams(context);
    const input = updateFileSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const existing = await findWorkspaceFile(
      supabase,
      workspaceContext.workspace.id,
      fileId
    );

    const { data: file, error } = await supabase
      .from("files")
      .update({
        ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      })
      .eq("id", existing.id)
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
      action: "file.updated",
      resourceType: "file",
      resourceId: file.id,
      metadata: {
        visibility: file.visibility
      }
    });

    return NextResponse.json({ file });
  });
}

export async function DELETE(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const existing = await findWorkspaceFile(
      supabase,
      workspaceContext.workspace.id,
      fileId
    );

    const { data: file, error } = await supabase
      .from("files")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", existing.id)
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
      action: "file.deleted",
      resourceType: "file",
      resourceId: file.id
    });

    return NextResponse.json({ file });
  });
}

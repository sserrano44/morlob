import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError, withApi } from "@/lib/api/errors";
import { findWorkspaceFile } from "@/lib/api/files";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

type Params = {
  orgId: string;
  workspaceId: string;
  fileId: string;
  linkId: string;
};

export async function DELETE(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId, linkId } = await routeParams(context);
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

    const { data: link, error: findError } = await supabase
      .from("resource_links")
      .select("id, public_id")
      .eq("workspace_id", workspaceContext.workspace.id)
      .eq("source_resource_type", "file")
      .eq("source_resource_id", file.id)
      .eq("public_id", linkId)
      .maybeSingle<{ id: string; public_id: string }>();

    if (findError) {
      throw findError;
    }

    if (!link) {
      throw new ApiError("not_found", "Resource link not found.");
    }

    const { error } = await supabase
      .from("resource_links")
      .delete()
      .eq("id", link.id);

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "file.unlinked",
      resourceType: "resource_link",
      resourceId: link.id,
      metadata: {
        file_id: file.public_id,
        link_id: link.public_id
      }
    });

    return NextResponse.json({ link });
  });
}

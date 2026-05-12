import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

type Params = { orgId: string; workspaceId: string; fileId: string };

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, fileId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();

    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .select("id, public_id, status")
      .eq("public_id", orgId)
      .maybeSingle<{ id: string; public_id: string; status: string }>();

    if (orgError) {
      throw orgError;
    }

    if (!organization || organization.status !== "active") {
      throw new ApiError("not_found", "Organization not found.");
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from("workspaces")
      .select("id, public_id, status")
      .eq("organization_id", organization.id)
      .eq("public_id", workspaceId)
      .maybeSingle<{ id: string; public_id: string; status: string }>();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspace || workspace.status !== "active") {
      throw new ApiError("not_found", "Workspace not found.");
    }

    const { data: file, error: fileError } = await supabase
      .from("files")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("public_id", fileId)
      .is("deleted_at", null)
      .maybeSingle();

    if (fileError) {
      throw fileError;
    }

    if (!file) {
      throw new ApiError("not_found", "File not found.");
    }

    let actor:
      | ReturnType<typeof actorDbFields>
      | { actorType: "system"; actorId: null } = {
      actorType: "system",
      actorId: null
    };

    if (file.visibility !== "public") {
      const workspaceContext = await requireWorkspaceContext(request, supabase, {
        orgPublicId: orgId,
        workspacePublicId: workspaceId,
        requiredAgentScope: "files:read"
      });
      actor = actorDbFields(workspaceContext.actor);
    } else if (request.headers.get("authorization")?.startsWith("Bearer ")) {
      const workspaceContext = await requireWorkspaceContext(request, supabase, {
        orgPublicId: orgId,
        workspacePublicId: workspaceId,
        requiredAgentScope: "files:read"
      });
      actor = actorDbFields(workspaceContext.actor);
    }

    const { data, error } = await supabase.storage
      .from(file.storage_bucket)
      .createSignedUrl(file.storage_path, 60 * 5, {
        download: file.filename
      });

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: organization.id,
      workspaceId: workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "file.download_url.created",
      resourceType: "file",
      resourceId: file.id,
      metadata: {
        visibility: file.visibility
      }
    });

    return NextResponse.json({
      url: data.signedUrl,
      expires_in: 300,
      visibility: file.visibility
    });
  });
}

import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { env } from "@/lib/config/env";
import { createPublicId } from "@/lib/core/ids";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { buildStoragePath, fileToBuffer, sha256 } from "@/lib/storage/files";
import {
  fileKindSchema,
  fileVisibilitySchema
} from "@/lib/validation/schemas";

type Params = { orgId: string; workspaceId: string };

export async function GET(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:read"
    });

    const { data, error } = await supabase
      .from("files")
      .select(
        "id, public_id, kind, filename, content_type, size_bytes, checksum_sha256, visibility, metadata, created_at, updated_at"
      )
      .eq("workspace_id", workspaceContext.workspace.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ files: data ?? [] });
  });
}

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "files:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new ApiError("validation_error", "Upload requires a file field.");
    }

    const buffer = await fileToBuffer(file);

    if (!buffer) {
      throw new ApiError("payload_too_large", "Files may not exceed 5 MB.");
    }

    const kind = fileKindSchema.parse(formData.get("kind") ?? "artifact");
    const visibility = fileVisibilitySchema.parse(
      formData.get("visibility") ?? "private"
    );
    const metadataValue = formData.get("metadata");
    const metadata =
      typeof metadataValue === "string" && metadataValue.trim()
        ? JSON.parse(metadataValue)
        : {};
    const publicId = createPublicId("file");
    const storagePath = buildStoragePath({
      organizationPublicId: workspaceContext.organization.public_id,
      workspacePublicId: workspaceContext.workspace.public_id,
      filePublicId: publicId,
      filename: file.name
    });

    const { error: uploadError } = await supabase.storage
      .from(env.MORLOB_STORAGE_BUCKET)
      .upload(storagePath, buffer, {
        contentType: file.type || "application/octet-stream",
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: fileRecord, error } = await supabase
      .from("files")
      .insert({
        public_id: publicId,
        organization_id: workspaceContext.organization.id,
        workspace_id: workspaceContext.workspace.id,
        uploader_type: actor.actorType,
        uploader_id: actor.actorId,
        kind,
        filename: file.name,
        content_type: file.type || "application/octet-stream",
        size_bytes: file.size,
        checksum_sha256: sha256(buffer),
        storage_bucket: env.MORLOB_STORAGE_BUCKET,
        storage_path: storagePath,
        visibility,
        metadata
      })
      .select(
        "id, public_id, kind, filename, content_type, size_bytes, checksum_sha256, visibility, metadata, created_at"
      )
      .single();

    if (error) {
      throw error;
    }

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "file.uploaded",
      resourceType: "file",
      resourceId: fileRecord.id,
      metadata: {
        visibility,
        size_bytes: file.size
      }
    });

    return NextResponse.json({ file: fileRecord }, { status: 201 });
  });
}

import { ApiError } from "@/lib/api/errors";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";

export type FileRecord = {
  id: string;
  public_id: string;
  organization_id: string;
  workspace_id: string;
  storage_bucket: string;
  storage_path: string;
  filename: string;
  visibility: "private" | "public";
};

export async function findWorkspaceFile(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  workspaceId: string,
  filePublicId: string
) {
  const { data: file, error } = await supabase
    .from("files")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("public_id", filePublicId)
    .is("deleted_at", null)
    .maybeSingle<FileRecord>();

  if (error) {
    throw error;
  }

  if (!file) {
    throw new ApiError("not_found", "File not found.");
  }

  return file;
}

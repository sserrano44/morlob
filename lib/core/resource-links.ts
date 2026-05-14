import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";

export type LinkableTarget = {
  id: string;
  public_id: string;
};

export async function resolveLinkTarget(input: {
  supabase: SupabaseClient;
  workspaceId: string;
  targetResourceType: "todo";
  targetPublicId: string;
}) {
  const tableByType = {
    todo: "todos"
  } satisfies Record<typeof input.targetResourceType, string>;

  const { data, error } = await input.supabase
    .from(tableByType[input.targetResourceType])
    .select("id, public_id")
    .eq("workspace_id", input.workspaceId)
    .eq("public_id", input.targetPublicId)
    .is("deleted_at", null)
    .maybeSingle<LinkableTarget>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new ApiError("not_found", "Link target not found.");
  }

  return data;
}

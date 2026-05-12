import type { SupabaseClient } from "@supabase/supabase-js";

type AuditInput = {
  organizationId: string;
  workspaceId?: string | null;
  actorType: "human" | "agent" | "org_key" | "system";
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function writeAuditEvent(
  supabase: SupabaseClient,
  input: AuditInput
) {
  const { error } = await supabase.from("audit_events").insert({
    organization_id: input.organizationId,
    workspace_id: input.workspaceId ?? null,
    actor_type: input.actorType,
    actor_id: input.actorId ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    metadata: input.metadata ?? {}
  });

  if (error) {
    console.error("Failed to write audit event", error);
  }
}

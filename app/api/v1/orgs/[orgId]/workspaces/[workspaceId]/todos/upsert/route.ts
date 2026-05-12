import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { createTodoSchema } from "@/lib/validation/schemas";

type Params = { orgId: string; workspaceId: string };

export async function POST(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId } = await routeParams(context);
    const input = createTodoSchema.parse(await request.json());

    if (!input.external_id) {
      throw new ApiError(
        "validation_error",
        "external_id is required for todo upsert."
      );
    }

    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "todos:write"
    });
    const actor = actorDbFields(workspaceContext.actor);

    const { data: existing, error: existingError } = await supabase
      .from("todos")
      .select("*")
      .eq("workspace_id", workspaceContext.workspace.id)
      .eq("source", input.source)
      .eq("external_id", input.external_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const { data: todo, error } = await supabase
        .from("todos")
        .update({
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          assignee_type: input.assignee_type ?? null,
          assignee_id: input.assignee_id ?? null,
          labels: input.labels,
          metadata: input.metadata,
          due_at: input.due_at ?? null,
          scheduled_for: input.scheduled_for ?? null
        })
        .eq("id", existing.id)
        .select("*")
        .single();

      if (error) {
        throw error;
      }

      await supabase.from("todo_events").insert({
        organization_id: workspaceContext.organization.id,
        workspace_id: workspaceContext.workspace.id,
        todo_id: todo.id,
        actor_type: actor.actorType,
        actor_id: actor.actorId,
        event_type: "upsert_updated",
        before: existing,
        after: todo
      });

      await writeAuditEvent(supabase, {
        organizationId: workspaceContext.organization.id,
        workspaceId: workspaceContext.workspace.id,
        actorType: actor.actorType,
        actorId: actor.actorId,
        action: "todo.upsert_updated",
        resourceType: "todo",
        resourceId: todo.id
      });

      return NextResponse.json({ todo, created: false });
    }

    const { data: todo, error } = await supabase
      .from("todos")
      .insert({
        organization_id: workspaceContext.organization.id,
        workspace_id: workspaceContext.workspace.id,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        assignee_type: input.assignee_type ?? null,
        assignee_id: input.assignee_id ?? null,
        source: input.source,
        external_id: input.external_id,
        labels: input.labels,
        metadata: input.metadata,
        due_at: input.due_at ?? null,
        scheduled_for: input.scheduled_for ?? null,
        created_by_type: actor.actorType,
        created_by_id: actor.actorId
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    await supabase.from("todo_events").insert({
      organization_id: workspaceContext.organization.id,
      workspace_id: workspaceContext.workspace.id,
      todo_id: todo.id,
      actor_type: actor.actorType,
      actor_id: actor.actorId,
      event_type: "upsert_created",
      after: todo
    });

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "todo.upsert_created",
      resourceType: "todo",
      resourceId: todo.id
    });

    return NextResponse.json({ todo, created: true }, { status: 201 });
  });
}

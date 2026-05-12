import { NextResponse } from "next/server";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError, withApi } from "@/lib/api/errors";
import { routeParams, type RouteContext } from "@/lib/api/params";
import {
  actorDbFields,
  requireWorkspaceContext
} from "@/lib/api/workspace-context";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { updateTodoSchema } from "@/lib/validation/schemas";

type Params = { orgId: string; workspaceId: string; todoId: string };

async function findTodo(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  workspaceId: string,
  todoPublicId: string
) {
  const { data: todo, error } = await supabase
    .from("todos")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("public_id", todoPublicId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!todo) {
    throw new ApiError("not_found", "Todo not found.");
  }

  return todo;
}

export async function GET(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, todoId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "todos:read"
    });
    const todo = await findTodo(supabase, workspaceContext.workspace.id, todoId);

    return NextResponse.json({ todo });
  });
}

export async function PATCH(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, todoId } = await routeParams(context);
    const input = updateTodoSchema.parse(await request.json());
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "todos:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const existing = await findTodo(supabase, workspaceContext.workspace.id, todoId);

    const update = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined
        ? { description: input.description ?? null }
        : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignee_type !== undefined
        ? { assignee_type: input.assignee_type ?? null }
        : {}),
      ...(input.assignee_id !== undefined
        ? { assignee_id: input.assignee_id ?? null }
        : {}),
      ...(input.labels !== undefined ? { labels: input.labels } : {}),
      ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      ...(input.due_at !== undefined ? { due_at: input.due_at ?? null } : {}),
      ...(input.scheduled_for !== undefined
        ? { scheduled_for: input.scheduled_for ?? null }
        : {})
    };

    const { data: todo, error } = await supabase
      .from("todos")
      .update(update)
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
      event_type: input.status === "completed" ? "completed" : "updated",
      before: existing,
      after: todo
    });

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: input.status === "completed" ? "todo.completed" : "todo.updated",
      resourceType: "todo",
      resourceId: todo.id
    });

    return NextResponse.json({ todo });
  });
}

export async function DELETE(request: Request, context: RouteContext<Params>) {
  return withApi(async () => {
    const { orgId, workspaceId, todoId } = await routeParams(context);
    const supabase = createSupabaseServiceClient();
    const workspaceContext = await requireWorkspaceContext(request, supabase, {
      orgPublicId: orgId,
      workspacePublicId: workspaceId,
      requiredAgentScope: "todos:write"
    });
    const actor = actorDbFields(workspaceContext.actor);
    const existing = await findTodo(supabase, workspaceContext.workspace.id, todoId);

    const { data: todo, error } = await supabase
      .from("todos")
      .update({ deleted_at: new Date().toISOString() })
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
      event_type: "deleted",
      before: existing,
      after: todo
    });

    await writeAuditEvent(supabase, {
      organizationId: workspaceContext.organization.id,
      workspaceId: workspaceContext.workspace.id,
      actorType: actor.actorType,
      actorId: actor.actorId,
      action: "todo.deleted",
      resourceType: "todo",
      resourceId: todo.id
    });

    return NextResponse.json({ todo });
  });
}

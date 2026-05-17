import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { writeAuditEvent } from "@/lib/api/audit";
import { ApiError } from "@/lib/api/errors";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import type { McpActor } from "@/lib/mcp/auth";
import { requireMcpScope } from "@/lib/mcp/auth";

const todoStatusSchema = z.enum([
  "open",
  "in_progress",
  "blocked",
  "waiting_for_review",
  "completed",
  "cancelled",
  "archived"
]);

const todoPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

const todoSourceSchema = z.enum([
  "manual",
  "api",
  "mcp",
  "claude_cowork",
  "openclaw",
  "codex",
  "other"
]);

const itemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    description: z.string().nullable(),
    status: todoStatusSchema,
    priority: todoPrioritySchema,
    source: todoSourceSchema,
    external_id: z.string().nullable(),
    labels: z.array(z.string()),
    metadata: z.record(z.string(), z.unknown()),
    due_at: z.string().nullable(),
    scheduled_for: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
  })
  .strict();

const listItemsOutputSchema = z
  .object({
    items: z.array(itemSchema)
  })
  .strict();

const itemOutputSchema = z
  .object({
    item: itemSchema
  })
  .strict();

const createItemOutputSchema = z
  .object({
    item: itemSchema,
    created: z.boolean()
  })
  .strict();

const deleteItemOutputSchema = z
  .object({
    item: itemSchema,
    deleted: z.literal(true)
  })
  .strict();

type TodoRow = {
  id: string;
  public_id: string;
  title: string;
  description: string | null;
  status: z.infer<typeof todoStatusSchema>;
  priority: z.infer<typeof todoPrioritySchema>;
  source: z.infer<typeof todoSourceSchema>;
  external_id: string | null;
  labels: string[];
  metadata: Record<string, unknown>;
  due_at: string | null;
  scheduled_for: string | null;
  created_at: string;
  updated_at: string;
};

function textResult<T extends Record<string, unknown>>(structuredContent: T) {
  return {
    structuredContent,
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(structuredContent)
      }
    ]
  };
}

function toItem(todo: TodoRow) {
  return {
    id: todo.public_id,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    priority: todo.priority,
    source: todo.source,
    external_id: todo.external_id,
    labels: todo.labels ?? [],
    metadata: todo.metadata ?? {},
    due_at: todo.due_at,
    scheduled_for: todo.scheduled_for,
    created_at: todo.created_at,
    updated_at: todo.updated_at
  };
}

async function findTodo(actor: McpActor, todoPublicId: string) {
  const supabase = createSupabaseServiceClient();
  const { data: todo, error } = await supabase
    .from("todos")
    .select("*")
    .eq("organization_id", actor.organizationId)
    .eq("workspace_id", actor.workspaceId)
    .eq("public_id", todoPublicId)
    .is("deleted_at", null)
    .maybeSingle<TodoRow>();

  if (error) {
    throw error;
  }

  if (!todo) {
    throw new ApiError("not_found", "Item not found.");
  }

  return { supabase, todo };
}

async function writeTodoEvent(input: {
  actor: McpActor;
  todo: TodoRow;
  eventType: string;
  before?: TodoRow;
  action: string;
}) {
  const supabase = createSupabaseServiceClient();

  await supabase.from("todo_events").insert({
    organization_id: input.actor.organizationId,
    workspace_id: input.actor.workspaceId,
    todo_id: input.todo.id,
    actor_type: input.actor.actorType,
    actor_id: input.actor.actorId,
    event_type: input.eventType,
    before: input.before ?? null,
    after: input.todo
  });

  await writeAuditEvent(supabase, {
    organizationId: input.actor.organizationId,
    workspaceId: input.actor.workspaceId,
    actorType: input.actor.actorType,
    actorId: input.actor.actorId,
    action: input.action,
    resourceType: "todo",
    resourceId: input.todo.id
  });
}

export function createMorlobMcpServer(actor: McpActor) {
  const server = new McpServer(
    {
      name: "morlob",
      version: "1.0.0"
    },
    {
      instructions:
        "Use Morlob tools to manage todos in the authorized workspace. Use returned item IDs for follow-up calls."
    }
  );

  server.registerTool(
    "list_items",
    {
      title: "List Morlob todos",
      description: "List todos from the authorized Morlob workspace.",
      inputSchema: z
        .object({
          status: todoStatusSchema.optional(),
          source: todoSourceSchema.optional(),
          external_id: z.string().trim().min(1).max(240).optional(),
          limit: z.number().int().min(1).max(100).default(50)
        })
        .strict(),
      outputSchema: listItemsOutputSchema
    },
    async ({ status, source, external_id, limit }) => {
      requireMcpScope(actor, "todos:read");
      const supabase = createSupabaseServiceClient();
      let query = supabase
        .from("todos")
        .select("*")
        .eq("organization_id", actor.organizationId)
        .eq("workspace_id", actor.workspaceId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (status) {
        query = query.eq("status", status);
      }

      if (source) {
        query = query.eq("source", source);
      }

      if (external_id) {
        query = query.eq("external_id", external_id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      return textResult({
        items: ((data ?? []) as TodoRow[]).map(toItem)
      });
    }
  );

  server.registerTool(
    "get_item",
    {
      title: "Get Morlob todo",
      description: "Fetch one todo by Morlob item ID.",
      inputSchema: z
        .object({
          id: z.string().trim().min(1)
        })
        .strict(),
      outputSchema: itemOutputSchema
    },
    async ({ id }) => {
      requireMcpScope(actor, "todos:read");
      const { todo } = await findTodo(actor, id);

      return textResult({ item: toItem(todo) });
    }
  );

  server.registerTool(
    "create_item",
    {
      title: "Create Morlob todo",
      description:
        "Create a todo in the authorized Morlob workspace. If source and external_id are supplied, this is idempotent and updates the existing matching todo instead of duplicating it.",
      inputSchema: z
        .object({
          title: z.string().trim().min(1).max(240),
          description: z.string().trim().max(10_000).nullable().optional(),
          status: todoStatusSchema.default("open"),
          priority: todoPrioritySchema.default("medium"),
          source: todoSourceSchema.default("claude_cowork"),
          external_id: z.string().trim().min(1).max(240).nullable().optional(),
          labels: z.array(z.string().trim().min(1).max(80)).default([]),
          metadata: z.record(z.string(), z.unknown()).default({}),
          due_at: z.string().datetime().nullable().optional(),
          scheduled_for: z.string().datetime().nullable().optional()
        })
        .strict(),
      outputSchema: createItemOutputSchema
    },
    async (input) => {
      requireMcpScope(actor, "todos:write");
      const supabase = createSupabaseServiceClient();
      const externalId = input.external_id ?? null;
      let existing: TodoRow | null = null;

      if (externalId) {
        const { data, error } = await supabase
          .from("todos")
          .select("*")
          .eq("workspace_id", actor.workspaceId)
          .eq("source", input.source)
          .eq("external_id", externalId)
          .is("deleted_at", null)
          .maybeSingle<TodoRow>();

        if (error) {
          throw error;
        }

        existing = data ?? null;
      }

      if (existing) {
        const { data: todo, error } = await supabase
          .from("todos")
          .update({
            title: input.title,
            description: input.description ?? null,
            status: input.status,
            priority: input.priority,
            labels: input.labels,
            metadata: input.metadata,
            due_at: input.due_at ?? null,
            scheduled_for: input.scheduled_for ?? null
          })
          .eq("id", existing.id)
          .select("*")
          .single<TodoRow>();

        if (error) {
          throw error;
        }

        await writeTodoEvent({
          actor,
          todo,
          before: existing,
          eventType: "upsert_updated",
          action: "todo.upsert_updated"
        });

        return textResult({ item: toItem(todo), created: false });
      }

      const { data: todo, error } = await supabase
        .from("todos")
        .insert({
          organization_id: actor.organizationId,
          workspace_id: actor.workspaceId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          source: input.source,
          external_id: externalId,
          labels: input.labels,
          metadata: input.metadata,
          due_at: input.due_at ?? null,
          scheduled_for: input.scheduled_for ?? null,
          created_by_type: actor.actorType,
          created_by_id: actor.actorId
        })
        .select("*")
        .single<TodoRow>();

      if (error) {
        throw error;
      }

      await writeTodoEvent({
        actor,
        todo,
        eventType: "created",
        action: "todo.created"
      });

      return textResult({ item: toItem(todo), created: true });
    }
  );

  server.registerTool(
    "update_item",
    {
      title: "Update Morlob todo",
      description: "Update editable fields on a Morlob todo.",
      inputSchema: z
        .object({
          id: z.string().trim().min(1),
          title: z.string().trim().min(1).max(240).optional(),
          description: z.string().trim().max(10_000).nullable().optional(),
          status: todoStatusSchema.optional(),
          priority: todoPrioritySchema.optional(),
          labels: z.array(z.string().trim().min(1).max(80)).optional(),
          metadata: z.record(z.string(), z.unknown()).optional(),
          due_at: z.string().datetime().nullable().optional(),
          scheduled_for: z.string().datetime().nullable().optional()
        })
        .strict(),
      outputSchema: itemOutputSchema
    },
    async ({ id, ...input }) => {
      requireMcpScope(actor, "todos:write");

      if (Object.keys(input).length === 0) {
        throw new ApiError("validation_error", "At least one update field is required.");
      }

      const { supabase, todo: existing } = await findTodo(actor, id);
      const { data: todo, error } = await supabase
        .from("todos")
        .update({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description ?? null }
            : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.priority !== undefined ? { priority: input.priority } : {}),
          ...(input.labels !== undefined ? { labels: input.labels } : {}),
          ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
          ...(input.due_at !== undefined ? { due_at: input.due_at ?? null } : {}),
          ...(input.scheduled_for !== undefined
            ? { scheduled_for: input.scheduled_for ?? null }
            : {})
        })
        .eq("id", existing.id)
        .select("*")
        .single<TodoRow>();

      if (error) {
        throw error;
      }

      await writeTodoEvent({
        actor,
        todo,
        before: existing,
        eventType: input.status === "completed" ? "completed" : "updated",
        action: input.status === "completed" ? "todo.completed" : "todo.updated"
      });

      return textResult({ item: toItem(todo) });
    }
  );

  server.registerTool(
    "complete_item",
    {
      title: "Complete Morlob todo",
      description: "Mark a Morlob todo as completed.",
      inputSchema: z
        .object({
          id: z.string().trim().min(1)
        })
        .strict(),
      outputSchema: itemOutputSchema
    },
    async ({ id }) => {
      requireMcpScope(actor, "todos:write");
      const { supabase, todo: existing } = await findTodo(actor, id);
      const { data: todo, error } = await supabase
        .from("todos")
        .update({ status: "completed" })
        .eq("id", existing.id)
        .select("*")
        .single<TodoRow>();

      if (error) {
        throw error;
      }

      await writeTodoEvent({
        actor,
        todo,
        before: existing,
        eventType: "completed",
        action: "todo.completed"
      });

      return textResult({ item: toItem(todo) });
    }
  );

  server.registerTool(
    "delete_item",
    {
      title: "Delete Morlob todo",
      description: "Soft-delete a Morlob todo from the authorized workspace.",
      inputSchema: z
        .object({
          id: z.string().trim().min(1)
        })
        .strict(),
      outputSchema: deleteItemOutputSchema
    },
    async ({ id }) => {
      requireMcpScope(actor, "todos:write");
      const { supabase, todo: existing } = await findTodo(actor, id);
      const { data: todo, error } = await supabase
        .from("todos")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("*")
        .single<TodoRow>();

      if (error) {
        throw error;
      }

      await writeTodoEvent({
        actor,
        todo,
        before: existing,
        eventType: "deleted",
        action: "todo.deleted"
      });

      return textResult({ item: toItem(todo), deleted: true });
    }
  );

  server.registerTool(
    "upsert_item_from_source",
    {
      title: "Upsert Morlob todo from source",
      description:
        "Create or update a todo by source and external_id. Use this for idempotent syncs and smoke tests.",
      inputSchema: z
        .object({
          source: todoSourceSchema.default("claude_cowork"),
          external_id: z.string().trim().min(1).max(240),
          title: z.string().trim().min(1).max(240),
          description: z.string().trim().max(10_000).nullable().optional(),
          status: todoStatusSchema.default("open"),
          priority: todoPrioritySchema.default("medium"),
          labels: z.array(z.string().trim().min(1).max(80)).default([]),
          metadata: z.record(z.string(), z.unknown()).default({}),
          due_at: z.string().datetime().nullable().optional(),
          scheduled_for: z.string().datetime().nullable().optional()
        })
        .strict(),
      outputSchema: createItemOutputSchema
    },
    async (input) => {
      requireMcpScope(actor, "todos:write");
      const supabase = createSupabaseServiceClient();
      const { data: existing, error: existingError } = await supabase
        .from("todos")
        .select("*")
        .eq("workspace_id", actor.workspaceId)
        .eq("source", input.source)
        .eq("external_id", input.external_id)
        .is("deleted_at", null)
        .maybeSingle<TodoRow>();

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
            labels: input.labels,
            metadata: input.metadata,
            due_at: input.due_at ?? null,
            scheduled_for: input.scheduled_for ?? null
          })
          .eq("id", existing.id)
          .select("*")
          .single<TodoRow>();

        if (error) {
          throw error;
        }

        await writeTodoEvent({
          actor,
          todo,
          before: existing,
          eventType: "upsert_updated",
          action: "todo.upsert_updated"
        });

        return textResult({ item: toItem(todo), created: false });
      }

      const { data: todo, error } = await supabase
        .from("todos")
        .insert({
          organization_id: actor.organizationId,
          workspace_id: actor.workspaceId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
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
        .single<TodoRow>();

      if (error) {
        throw error;
      }

      await writeTodoEvent({
        actor,
        todo,
        eventType: "upsert_created",
        action: "todo.upsert_created"
      });

      return textResult({ item: toItem(todo), created: true });
    }
  );

  return server;
}

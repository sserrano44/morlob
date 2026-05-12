import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120)
});

export const createAgentSchema = z.object({
  name: z.string().trim().min(1).max(120),
  kind: z.string().trim().min(1).max(80).default("generic"),
  metadata: z.record(z.string(), z.unknown()).default({})
});

export const createAgentKeySchema = z.object({
  name: z.string().trim().min(1).max(120).default("Default key"),
  scopes: z.array(z.string().trim().min(1)).min(1)
});

export const createAssignmentSchema = z.object({
  workspace_id: z.string().trim().min(1)
});

export const createTodoSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.string().trim().max(10_000).optional().nullable(),
  status: z
    .enum([
      "open",
      "in_progress",
      "blocked",
      "waiting_for_review",
      "completed",
      "cancelled",
      "archived"
    ])
    .default("open"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignee_type: z.enum(["human", "agent"]).optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  source: z
    .enum(["manual", "api", "mcp", "claude_cowork", "openclaw", "codex", "other"])
    .default("api"),
  external_id: z.string().trim().min(1).max(240).optional().nullable(),
  labels: z.array(z.string().trim().min(1).max(80)).default([]),
  metadata: z.record(z.string(), z.unknown()).default({}),
  due_at: z.string().datetime().optional().nullable(),
  scheduled_for: z.string().datetime().optional().nullable()
});

export const updateTodoSchema = createTodoSchema.partial();

export const updateFileSchema = z.object({
  visibility: z.enum(["private", "public"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
});

export const fileKindSchema = z
  .enum(["artifact", "attachment", "knowledge_source", "skill_asset", "log", "export", "other"])
  .default("artifact");

export const fileVisibilitySchema = z.enum(["private", "public"]).default("private");

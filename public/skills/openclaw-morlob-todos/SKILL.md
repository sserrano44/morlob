---
name: morlob_todos
description: Use Morlob's production REST API to list, create, complete, and delete workspace todos.
---

# Morlob Todos

Use this skill when the user wants OpenClaw to manage Morlob todos through the Morlob REST API.

Morlob production base URL:

```text
https://www.morlob.com
```

## Inputs

Before calling the API, identify:

- `MORLOB_AGENT_API_KEY`: an agent API key beginning with `mlb_`.
- `MORLOB_ORG_ID`: the Morlob organization public ID, such as `org_...`.
- `MORLOB_WORKSPACE_ID`: the Morlob workspace public ID, such as `wsp_...`.

If any value is missing, ask the user for it or read it from the agent environment/config if available. Never print, log, or store the API key in chat or files.

The agent key must have:

- `todos:read` for listing todos.
- `todos:write` for creating, completing, and deleting todos.
- An active assignment to the requested workspace.

## HTTP Rules

Use the best available HTTP client or tool. If using shell, prefer `curl`.

Send every request with:

```text
Authorization: Bearer $MORLOB_AGENT_API_KEY
Content-Type: application/json
```

Workspace routes always use explicit organization and workspace IDs:

```text
https://www.morlob.com/api/v1/orgs/{org_id}/workspaces/{workspace_id}
```

Use Morlob public IDs in API paths, not database UUIDs.

## Discover Agent Context

When the user is unsure which workspace the key can access, call:

```http
GET https://www.morlob.com/api/v1/agents/me
```

Expected response shape:

```json
{
  "agent": {
    "id": "agt_...",
    "name": "OpenClaw",
    "organization_id": "org_...",
    "scopes": ["todos:read", "todos:write"]
  },
  "workspaces": [
    {
      "public_id": "wsp_...",
      "name": "Default",
      "status": "active"
    }
  ]
}
```

Use the `agent.organization_id` and the selected workspace `public_id` as the route IDs.

## List Todos

```http
GET https://www.morlob.com/api/v1/orgs/{org_id}/workspaces/{workspace_id}/todos
```

Example:

```bash
curl -sS \
  -H "Authorization: Bearer $MORLOB_AGENT_API_KEY" \
  "https://www.morlob.com/api/v1/orgs/$MORLOB_ORG_ID/workspaces/$MORLOB_WORKSPACE_ID/todos"
```

The response is:

```json
{
  "todos": [
    {
      "public_id": "todo_...",
      "title": "Review deployment",
      "description": null,
      "status": "open",
      "priority": "medium",
      "source": "openclaw",
      "labels": [],
      "metadata": {},
      "due_at": null,
      "scheduled_for": null,
      "created_at": "2026-05-16T12:00:00.000Z",
      "updated_at": "2026-05-16T12:00:00.000Z"
    }
  ]
}
```

Summarize todos by `public_id`, `title`, `status`, `priority`, and dates. Do not expose internal `id` values unless the user specifically asks for raw output.

## Create Todo

```http
POST https://www.morlob.com/api/v1/orgs/{org_id}/workspaces/{workspace_id}/todos
```

Required field:

- `title`

Useful optional fields:

- `description`
- `status`: `open`, `in_progress`, `blocked`, `waiting_for_review`, `completed`, `cancelled`, `archived`
- `priority`: `low`, `medium`, `high`, `urgent`
- `source`: use `openclaw`
- `external_id`: use a stable ID when syncing from another system
- `labels`
- `metadata`
- `due_at` or `scheduled_for` as RFC 3339 datetime strings

Example:

```bash
curl -sS \
  -X POST \
  -H "Authorization: Bearer $MORLOB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Draft OpenClaw todo skill",
    "description": "Create first REST API skill for Morlob todos.",
    "priority": "medium",
    "source": "openclaw",
    "labels": ["openclaw"]
  }' \
  "https://www.morlob.com/api/v1/orgs/$MORLOB_ORG_ID/workspaces/$MORLOB_WORKSPACE_ID/todos"
```

The response is:

```json
{
  "todo": {
    "public_id": "todo_...",
    "title": "Draft OpenClaw todo skill",
    "status": "open"
  }
}
```

Return the created todo's `public_id`, `title`, and `status` to the user.

## Complete Todo

Complete a todo by patching its status:

```http
PATCH https://www.morlob.com/api/v1/orgs/{org_id}/workspaces/{workspace_id}/todos/{todo_id}
```

Example:

```bash
curl -sS \
  -X PATCH \
  -H "Authorization: Bearer $MORLOB_AGENT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"completed"}' \
  "https://www.morlob.com/api/v1/orgs/$MORLOB_ORG_ID/workspaces/$MORLOB_WORKSPACE_ID/todos/$TODO_ID"
```

Use a `todo_...` public ID for `TODO_ID`.

## Delete Todo

Delete a todo only when the user explicitly asks to delete it. If the request is ambiguous, ask for confirmation and include the todo title and `todo_...` ID.

```http
DELETE https://www.morlob.com/api/v1/orgs/{org_id}/workspaces/{workspace_id}/todos/{todo_id}
```

Example:

```bash
curl -sS \
  -X DELETE \
  -H "Authorization: Bearer $MORLOB_AGENT_API_KEY" \
  "https://www.morlob.com/api/v1/orgs/$MORLOB_ORG_ID/workspaces/$MORLOB_WORKSPACE_ID/todos/$TODO_ID"
```

Morlob performs a soft delete and returns the deleted todo.

## Error Handling

All API errors use:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed.",
    "details": {}
  }
}
```

Report the `error.code` and `error.message` to the user. For `unauthorized`, `forbidden`, or workspace assignment failures, ask the user to verify the agent API key, scopes, organization ID, workspace ID, and workspace assignment.

# REST API

Morlob exposes the same public API under both route shapes:

```text
/api/v1/...
/v1/...
```

Workspace-scoped routes always include explicit organization and workspace IDs:

```text
/api/v1/orgs/:org_id/workspaces/:workspace_id/...
```

Use Morlob public IDs such as `org_...`, `wsp_...`, `agt_...`, `todo_...`, and `file_...`.

## MCP

```text
POST /api/mcp
GET  /api/mcp
```

`POST /api/mcp` is the remote Streamable HTTP MCP endpoint. It accepts MCP JSON-RPC requests with OAuth bearer tokens issued by Morlob, and also supports existing Morlob agent API keys for non-Claude agents.

`GET /api/mcp` returns an OAuth challenge when unauthenticated and `405` when authenticated because this deployment uses stateless JSON responses over POST.

OAuth discovery:

```text
GET /.well-known/oauth-protected-resource
GET /.well-known/oauth-authorization-server
GET /oauth/authorize
POST /oauth/authorize
POST /oauth/token
```

## Authentication

Human UI/API requests use Supabase Auth cookies.

Agent requests use:

```text
Authorization: Bearer mlb_...
```

Agent requests must pass:

- active organization
- active workspace
- active agent
- non-revoked API key
- required scope
- explicit workspace assignment

## Health

```text
GET /api/v1/health
```

## Organizations

```text
GET  /api/v1/orgs
POST /api/v1/orgs
```

Create body:

```json
{
  "name": "Acme"
}
```

## Workspaces

```text
GET  /api/v1/orgs/:org_id/workspaces
POST /api/v1/orgs/:org_id/workspaces
```

Create body:

```json
{
  "name": "Default"
}
```

## Agents

```text
GET  /api/v1/orgs/:org_id/agents
POST /api/v1/orgs/:org_id/agents
GET  /api/v1/orgs/:org_id/agents/:agent_id
PATCH /api/v1/orgs/:org_id/agents/:agent_id
DELETE /api/v1/orgs/:org_id/agents/:agent_id
POST /api/v1/orgs/:org_id/agents/:agent_id/keys
DELETE /api/v1/orgs/:org_id/agents/:agent_id/keys/:key_id
POST /api/v1/orgs/:org_id/agents/:agent_id/workspace-assignments
DELETE /api/v1/orgs/:org_id/agents/:agent_id/workspace-assignments/:workspace_id
GET /api/v1/agents/me
```

Agent list responses include active `workspace_assignments`.

Create key body:

```json
{
  "name": "Default key",
  "workspace_id": "wsp_...",
  "scopes": ["todos:read", "todos:write", "files:read", "files:write"]
}
```

Key creation assigns the agent to `workspace_id`. If `workspace_id` is omitted, Morlob assigns the agent to the first active workspace in the organization.

API key secrets are returned once and only a salted one-way hash is stored.

## Todos

```text
GET    /api/v1/orgs/:org_id/workspaces/:workspace_id/todos
POST   /api/v1/orgs/:org_id/workspaces/:workspace_id/todos
GET    /api/v1/orgs/:org_id/workspaces/:workspace_id/todos/:todo_id
PATCH  /api/v1/orgs/:org_id/workspaces/:workspace_id/todos/:todo_id
DELETE /api/v1/orgs/:org_id/workspaces/:workspace_id/todos/:todo_id
POST   /api/v1/orgs/:org_id/workspaces/:workspace_id/todos/upsert
```

Todo upsert requires `external_id` and matches by workspace, source, and external ID.

## Files

```text
GET    /api/v1/orgs/:org_id/workspaces/:workspace_id/files
POST   /api/v1/orgs/:org_id/workspaces/:workspace_id/files
GET    /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id
PATCH  /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id
DELETE /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id
POST   /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id/download-url
```

Upload is multipart form data:

```text
file=<binary>
kind=artifact
visibility=private|public
todo_id=todo_... optional
metadata={} optional JSON string
```

Files are capped at 5 MB by default.

Private files require workspace access to create signed download URLs.
Public files can create signed download URLs without workspace authentication.

## File Links

```text
GET    /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id/links
POST   /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id/links
DELETE /api/v1/orgs/:org_id/workspaces/:workspace_id/files/:file_id/links/:link_id
```

Create body:

```json
{
  "target_resource_type": "todo",
  "target_resource_id": "todo_...",
  "relationship": "artifact"
}
```

## Error Shape

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

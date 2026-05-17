# Claude Cowork MCP Connector

Morlob exposes a remote MCP connector for Claude Cowork at:

```text
https://www.morlob.com/api/mcp
```

The connector uses OAuth Authorization Code + PKCE. Claude connects as a public OAuth client; Morlob does not require a client secret.

## Discovery Endpoints

```text
https://www.morlob.com/.well-known/oauth-protected-resource
https://www.morlob.com/.well-known/oauth-authorization-server
```

The MCP endpoint returns a `WWW-Authenticate` challenge when Claude connects without a bearer token. Claude uses the protected resource metadata URL from that challenge to discover the OAuth flow.

## Connection Steps

1. Deploy Morlob to a public HTTPS URL.
2. Apply database migrations.
3. Set `NEXT_PUBLIC_APP_URL` to the production origin, for example `https://www.morlob.com`.
4. Open Claude Cowork or Claude settings.
5. Go to Settings -> Connectors.
6. Add a custom connector.
7. Name it `Morlob`.
8. Use the MCP server URL:

```text
https://www.morlob.com/api/mcp
```

9. Click Connect.
10. Sign into Morlob when redirected.
11. Approve the consent page and select the workspace Claude should access.
12. Confirm Claude shows the connector as connected.

## OAuth Behavior

Morlob supports:

- `authorization_code` with PKCE S256.
- `refresh_token` with refresh-token rotation.
- URL-style public `client_id` values.
- Redirect URIs using `https://`, `http://localhost...`, `http://127.0.0.1...`, and `claude://`.

Tokens are opaque. Morlob stores only hashes of authorization codes, access tokens, and refresh tokens.

Token lifetimes:

- Authorization code: 10 minutes, single use.
- Access token: 1 hour.
- Refresh token: 30 days.

Supported OAuth scopes:

- `todos:read`
- `todos:write`

## MCP Tools

The connector exposes Morlob todo tools for the authorized workspace:

- `list_items`
- `get_item`
- `create_item`
- `update_item`
- `complete_item`
- `delete_item`
- `upsert_item_from_source`

Every tool response includes both:

- `structuredContent`
- text `content` containing the same result as JSON

## Smoke Test Prompt

Use this prompt in Claude after connecting:

```text
Test the Morlob MCP connector. First list existing items. Then create a temporary item with source claude_cowork and external_id claude-smoke-test-<timestamp>. Fetch it by ID and verify the fields persisted. Update or complete it. Fetch it again and confirm the status changed. Delete it. Finally search/list again and confirm the temporary item is gone. Report each tool call and whether it passed.
```

## Manual Verification

Unauthenticated MCP requests should return a challenge:

```bash
curl -i https://www.morlob.com/api/mcp
```

Expected:

```text
HTTP/2 401
WWW-Authenticate: Bearer realm="morlob MCP", resource_metadata="https://www.morlob.com/.well-known/oauth-protected-resource"
```

Discovery endpoints should return JSON:

```bash
curl -fsSL https://www.morlob.com/.well-known/oauth-protected-resource
curl -fsSL https://www.morlob.com/.well-known/oauth-authorization-server
```

Invalid token exchanges should fail cleanly:

```bash
curl -fsSL -X POST https://www.morlob.com/oauth/token \
  -H "content-type: application/x-www-form-urlencoded" \
  --data "grant_type=authorization_code&client_id=https://claude.ai/oauth/mcp-oauth-client-metadata&code=bad&redirect_uri=https://claude.ai/api/mcp/auth_callback&code_verifier=bad"
```

Expected response:

```json
{
  "error": "invalid_grant",
  "error_description": "Invalid authorization code."
}
```

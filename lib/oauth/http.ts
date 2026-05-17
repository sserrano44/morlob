import { NextResponse } from "next/server";

import { env } from "@/lib/config/env";
import {
  OAUTH_SCOPES,
  mcpResourceUrl,
  oauthIssuer,
  requestOrigin
} from "@/lib/oauth/config";

export const oauthCorsHeaders = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers":
    "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id",
  "access-control-expose-headers":
    "WWW-Authenticate, MCP-Protocol-Version, MCP-Session-Id"
};

export function jsonWithCors(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);

  for (const [key, value] of Object.entries(oauthCorsHeaders)) {
    headers.set(key, value);
  }

  return NextResponse.json(body, {
    ...init,
    headers
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: oauthCorsHeaders
  });
}

export function protectedResourceMetadata(request?: Request) {
  const origin = request ? requestOrigin(request) : undefined;

  return {
    resource: mcpResourceUrl(origin),
    authorization_servers: [oauthIssuer(origin)],
    bearer_methods_supported: ["header"],
    scopes_supported: OAUTH_SCOPES
  };
}

export function authorizationServerMetadata(request?: Request) {
  const origin = request ? requestOrigin(request) : undefined;
  const issuer = oauthIssuer(origin);

  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/oauth/token`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: OAUTH_SCOPES,
    client_id_metadata_document_supported: true
  };
}

export function oauthChallenge(request?: Request) {
  const origin = request ? requestOrigin(request) : undefined;

  return `Bearer realm="${env.MCP_SERVER_NAME} MCP", resource_metadata="${oauthIssuer(origin)}/.well-known/oauth-protected-resource"`;
}

export function unauthorizedMcpResponse(request?: Request) {
  return jsonWithCors(
    {
      error: "invalid_token",
      error_description: "Authorization required."
    },
    {
      status: 401,
      headers: {
        "www-authenticate": oauthChallenge(request)
      }
    }
  );
}

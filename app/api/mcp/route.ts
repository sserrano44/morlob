import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { authenticateMcpRequest } from "@/lib/mcp/auth";
import { createMorlobMcpServer } from "@/lib/mcp/todo-tools";
import {
  corsPreflight,
  jsonWithCors,
  oauthCorsHeaders,
  unauthorizedMcpResponse
} from "@/lib/oauth/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function withMcpCors(response: Response) {
  const headers = new Headers(response.headers);

  for (const [key, value] of Object.entries(oauthCorsHeaders)) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function OPTIONS() {
  return corsPreflight();
}

export async function GET(request: Request) {
  const actor = await authenticateMcpRequest(request);

  if (!actor) {
    return unauthorizedMcpResponse();
  }

  return jsonWithCors(
    {
      error: "method_not_allowed",
      error_description: "POST is required for this MCP endpoint."
    },
    {
      status: 405,
      headers: {
        allow: "POST, OPTIONS"
      }
    }
  );
}

export async function POST(request: Request) {
  const actor = await authenticateMcpRequest(request);

  if (!actor) {
    return unauthorizedMcpResponse();
  }

  const server = createMorlobMcpServer(actor);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true
  });

  await server.connect(transport);

  try {
    const response = await transport.handleRequest(request);
    return withMcpCors(response);
  } finally {
    await transport.close();
  }
}

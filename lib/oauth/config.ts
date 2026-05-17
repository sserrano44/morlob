import { env } from "@/lib/config/env";

export const OAUTH_SCOPES = ["todos:read", "todos:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTHORIZATION_CODE_TTL_SECONDS = 60 * 10;

function firstHeaderValue(value: string | null) {
  return value?.split(",")[0]?.trim() ?? "";
}

function normalizeOrigin(origin: string) {
  return origin.replace(/\/+$/, "");
}

export function appBaseUrl(origin?: string | null) {
  return normalizeOrigin(origin || env.NEXT_PUBLIC_APP_URL);
}

export function requestOrigin(request: Request) {
  const requestUrl = new URL(request.url);
  const forwardedHost = firstHeaderValue(
    request.headers.get("x-forwarded-host")
  );
  const host = forwardedHost || firstHeaderValue(request.headers.get("host"));

  if (!host) {
    return appBaseUrl();
  }

  const hostname = host.split(":")[0] ?? host;
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const forwardedProto = firstHeaderValue(
    request.headers.get("x-forwarded-proto")
  );
  const protocol =
    forwardedProto || (isLocalhost ? requestUrl.protocol.replace(":", "") : "https");

  return normalizeOrigin(`${protocol}://${host}`);
}

export function mcpResourceUrl(origin?: string | null) {
  const endpoint = env.MCP_ENDPOINT.startsWith("/")
    ? env.MCP_ENDPOINT
    : `/${env.MCP_ENDPOINT}`;

  return `${appBaseUrl(origin)}${endpoint}`;
}

export function oauthIssuer(origin?: string | null) {
  return appBaseUrl(origin);
}

export function scopeString(scopes: readonly string[]) {
  return scopes.join(" ");
}

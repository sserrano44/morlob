import { env } from "@/lib/config/env";

export const OAUTH_SCOPES = ["todos:read", "todos:write"] as const;
export type OAuthScope = (typeof OAUTH_SCOPES)[number];

export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 60 * 24 * 30;
export const AUTHORIZATION_CODE_TTL_SECONDS = 60 * 10;

export function appBaseUrl() {
  return env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
}

export function mcpResourceUrl() {
  const endpoint = env.MCP_ENDPOINT.startsWith("/")
    ? env.MCP_ENDPOINT
    : `/${env.MCP_ENDPOINT}`;

  return `${appBaseUrl()}${endpoint}`;
}

export function oauthIssuer() {
  return appBaseUrl();
}

export function scopeString(scopes: readonly string[]) {
  return scopes.join(" ");
}

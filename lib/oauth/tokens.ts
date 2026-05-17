import type { SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "@/lib/api/errors";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  AUTHORIZATION_CODE_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  mcpResourceUrl
} from "@/lib/oauth/config";
import {
  createOpaqueToken,
  hashSecret,
  verifyPkceS256
} from "@/lib/oauth/security";

type OAuthTokenContext = {
  user_id: string;
  organization_id: string;
  workspace_id: string;
  client_id: string;
  scope: string[];
  resource: string;
};

type AuthorizationCodeRow = OAuthTokenContext & {
  id: string;
  code_hash: string;
  redirect_uri: string;
  code_challenge: string;
  code_challenge_method: string;
  expires_at: string;
  used_at: string | null;
};

type RefreshTokenRow = OAuthTokenContext & {
  id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
};

type AccessTokenRow = OAuthTokenContext & {
  id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  organizations:
    | {
        public_id: string;
        name: string;
        slug: string;
        status: string;
      }
    | {
        public_id: string;
        name: string;
        slug: string;
        status: string;
      }[]
    | null;
  workspaces:
    | {
        public_id: string;
        name: string;
        slug: string;
        status: string;
      }
    | {
        public_id: string;
        name: string;
        slug: string;
        status: string;
      }[]
    | null;
};

export type OAuthAccessActor = {
  type: "oauth";
  userId: string;
  organizationId: string;
  organizationPublicId: string;
  workspaceId: string;
  workspacePublicId: string;
  clientId: string;
  scopes: string[];
  resource: string;
};

function expiresInSeconds(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function secondsUntil(value: string) {
  return Math.max(0, Math.floor((Date.parse(value) - Date.now()) / 1000));
}

function isExpired(value: string) {
  return Date.parse(value) <= Date.now();
}

async function issueTokenPair(
  supabase: SupabaseClient,
  context: OAuthTokenContext
) {
  const refreshToken = createOpaqueToken("mor");
  const refreshExpiresAt = expiresInSeconds(REFRESH_TOKEN_TTL_SECONDS);
  const { data: refresh, error: refreshError } = await supabase
    .from("oauth_refresh_tokens")
    .insert({
      token_hash: hashSecret(refreshToken),
      user_id: context.user_id,
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      client_id: context.client_id,
      scope: context.scope,
      resource: context.resource,
      expires_at: refreshExpiresAt
    })
    .select("id, expires_at")
    .single<{ id: string; expires_at: string }>();

  if (refreshError) {
    throw refreshError;
  }

  const accessToken = createOpaqueToken("moa");
  const accessExpiresAt = expiresInSeconds(ACCESS_TOKEN_TTL_SECONDS);
  const { error: accessError } = await supabase
    .from("oauth_access_tokens")
    .insert({
      token_hash: hashSecret(accessToken),
      refresh_token_id: refresh.id,
      user_id: context.user_id,
      organization_id: context.organization_id,
      workspace_id: context.workspace_id,
      client_id: context.client_id,
      scope: context.scope,
      resource: context.resource,
      expires_at: accessExpiresAt
    });

  if (accessError) {
    throw accessError;
  }

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer" as const,
    expires_in: ACCESS_TOKEN_TTL_SECONDS,
    scope: context.scope.join(" "),
    refresh_token_expires_in: secondsUntil(refresh.expires_at)
  };
}

export async function issueAuthorizationCode(
  supabase: SupabaseClient,
  input: OAuthTokenContext & {
    redirect_uri: string;
    code_challenge: string;
    code_challenge_method: "S256";
  }
) {
  const code = createOpaqueToken("moc");
  const { error } = await supabase.from("oauth_authorization_codes").insert({
    code_hash: hashSecret(code),
    user_id: input.user_id,
    organization_id: input.organization_id,
    workspace_id: input.workspace_id,
    client_id: input.client_id,
    redirect_uri: input.redirect_uri,
    scope: input.scope,
    resource: input.resource,
    code_challenge: input.code_challenge,
    code_challenge_method: input.code_challenge_method,
    expires_at: expiresInSeconds(AUTHORIZATION_CODE_TTL_SECONDS)
  });

  if (error) {
    throw error;
  }

  return code;
}

export async function exchangeAuthorizationCode(
  supabase: SupabaseClient,
  input: {
    code: string;
    client_id: string;
    redirect_uri: string;
    code_verifier: string;
    resource?: string | null;
  }
) {
  const { data: codeRow, error } = await supabase
    .from("oauth_authorization_codes")
    .select("*")
    .eq("code_hash", hashSecret(input.code))
    .maybeSingle<AuthorizationCodeRow>();

  if (error) {
    throw error;
  }

  if (
    !codeRow ||
    codeRow.used_at ||
    isExpired(codeRow.expires_at) ||
    codeRow.client_id !== input.client_id ||
    codeRow.redirect_uri !== input.redirect_uri ||
    (input.resource && codeRow.resource !== input.resource) ||
    codeRow.code_challenge_method !== "S256" ||
    !verifyPkceS256(input.code_verifier, codeRow.code_challenge)
  ) {
    throw new ApiError("validation_error", "Invalid authorization code.");
  }

  const { data: usedCode, error: usedError } = await supabase
    .from("oauth_authorization_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("id", codeRow.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle<{ id: string }>();

  if (usedError) {
    throw usedError;
  }

  if (!usedCode) {
    throw new ApiError("validation_error", "Authorization code already used.");
  }

  return issueTokenPair(supabase, codeRow);
}

export async function refreshOAuthAccessToken(
  supabase: SupabaseClient,
  input: {
    refresh_token: string;
    client_id: string;
  }
) {
  const { data: refresh, error } = await supabase
    .from("oauth_refresh_tokens")
    .select("*")
    .eq("token_hash", hashSecret(input.refresh_token))
    .maybeSingle<RefreshTokenRow>();

  if (error) {
    throw error;
  }

  if (
    !refresh ||
    refresh.revoked_at ||
    isExpired(refresh.expires_at) ||
    refresh.client_id !== input.client_id
  ) {
    throw new ApiError("validation_error", "Invalid refresh token.");
  }

  const nextPair = await issueTokenPair(supabase, refresh);

  const { data: replacement } = await supabase
    .from("oauth_refresh_tokens")
    .select("id")
    .eq("token_hash", hashSecret(nextPair.refresh_token))
    .maybeSingle<{ id: string }>();

  await supabase
    .from("oauth_refresh_tokens")
    .update({
      revoked_at: new Date().toISOString(),
      last_used_at: new Date().toISOString(),
      replaced_by_id: replacement?.id ?? null
    })
    .eq("id", refresh.id);

  return nextPair;
}

export async function validateOAuthAccessToken(
  supabase: SupabaseClient,
  accessToken: string,
  expectedResource = mcpResourceUrl()
): Promise<OAuthAccessActor | null> {
  const { data: token, error } = await supabase
    .from("oauth_access_tokens")
    .select(
      "id, token_hash, user_id, organization_id, workspace_id, client_id, scope, resource, expires_at, revoked_at, organizations(public_id, name, slug, status), workspaces(public_id, name, slug, status)"
    )
    .eq("token_hash", hashSecret(accessToken))
    .maybeSingle<AccessTokenRow>();

  if (error) {
    throw error;
  }

  if (
    !token ||
    token.revoked_at ||
    isExpired(token.expires_at) ||
    token.resource !== expectedResource
  ) {
    return null;
  }

  const organization = Array.isArray(token.organizations)
    ? token.organizations[0]
    : token.organizations;
  const workspace = Array.isArray(token.workspaces)
    ? token.workspaces[0]
    : token.workspaces;

  if (
    !organization ||
    organization.status !== "active" ||
    !workspace ||
    workspace.status !== "active"
  ) {
    return null;
  }

  const { data: membership, error: membershipError } = await supabase
    .from("workspace_memberships")
    .select("id")
    .eq("workspace_id", token.workspace_id)
    .eq("user_id", token.user_id)
    .maybeSingle<{ id: string }>();

  if (membershipError) {
    throw membershipError;
  }

  if (!membership) {
    return null;
  }

  await supabase
    .from("oauth_access_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", token.id);

  return {
    type: "oauth",
    userId: token.user_id,
    organizationId: token.organization_id,
    organizationPublicId: organization.public_id,
    workspaceId: token.workspace_id,
    workspacePublicId: workspace.public_id,
    clientId: token.client_id,
    scopes: token.scope,
    resource: token.resource
  };
}

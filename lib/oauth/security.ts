import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { OAUTH_SCOPES, type OAuthScope } from "@/lib/oauth/config";

const TOKEN_BYTES = 32;

export function createOpaqueToken(prefix: string) {
  return `${prefix}_${randomBytes(TOKEN_BYTES).toString("base64url")}`;
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function verifyPkceS256(verifier: string, challenge: string) {
  const computed = createHash("sha256").update(verifier).digest("base64url");
  return constantTimeEqual(computed, challenge);
}

export function parseScopes(scope: string | null | undefined) {
  const requested = scope?.trim()
    ? scope.trim().split(/\s+/)
    : [...OAUTH_SCOPES];
  const unsupported = requested.filter(
    (item): item is string => !OAUTH_SCOPES.includes(item as OAuthScope)
  );

  if (unsupported.length > 0) {
    throw new Error(`Unsupported scope: ${unsupported.join(", ")}`);
  }

  return [...new Set(requested)] as OAuthScope[];
}

export function isAllowedRedirectUri(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol === "https:" || url.protocol === "claude:") {
      return true;
    }

    if (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export function appendRedirectParams(
  redirectUri: string,
  params: Record<string, string | undefined>
) {
  const url = new URL(redirectUri);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

export function safeInternalPath(value: string | null | undefined) {
  if (!value?.startsWith("/") || value.startsWith("//")) {
    return "/app";
  }

  return value;
}

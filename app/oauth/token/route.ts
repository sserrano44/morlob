import { ApiError } from "@/lib/api/errors";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { corsPreflight, jsonWithCors } from "@/lib/oauth/http";
import {
  exchangeAuthorizationCode,
  refreshOAuthAccessToken
} from "@/lib/oauth/tokens";

export const dynamic = "force-dynamic";

function oauthError(
  error: string,
  description: string,
  status = 400
) {
  return jsonWithCors(
    {
      error,
      error_description: description
    },
    { status }
  );
}

export function OPTIONS() {
  return corsPreflight();
}

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/x-www-form-urlencoded")) {
    return oauthError(
      "invalid_request",
      "Token requests must use application/x-www-form-urlencoded."
    );
  }

  const form = new URLSearchParams(await request.text());
  const grantType = form.get("grant_type");
  const clientId = form.get("client_id");

  if (!clientId) {
    return oauthError("invalid_request", "client_id is required.");
  }

  const supabase = createSupabaseServiceClient();

  try {
    if (grantType === "authorization_code") {
      const code = form.get("code");
      const redirectUri = form.get("redirect_uri");
      const codeVerifier = form.get("code_verifier");

      if (!code || !redirectUri || !codeVerifier) {
        return oauthError(
          "invalid_request",
          "code, redirect_uri, and code_verifier are required."
        );
      }

      const payload = await exchangeAuthorizationCode(supabase, {
        code,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        resource: form.get("resource")
      });

      return jsonWithCors(payload);
    }

    if (grantType === "refresh_token") {
      const refreshToken = form.get("refresh_token");

      if (!refreshToken) {
        return oauthError("invalid_request", "refresh_token is required.");
      }

      const payload = await refreshOAuthAccessToken(supabase, {
        refresh_token: refreshToken,
        client_id: clientId
      });

      return jsonWithCors(payload);
    }

    return oauthError("unsupported_grant_type", "Unsupported grant_type.");
  } catch (error) {
    if (error instanceof ApiError) {
      return oauthError("invalid_grant", error.message);
    }

    console.error(error);
    return oauthError("server_error", "Token exchange failed.", 500);
  }
}

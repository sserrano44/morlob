import { NextResponse } from "next/server";

import { ensureUserAccess } from "@/lib/auth/access";
import { createSupabaseServerClient } from "@/lib/data/supabase/server";
import { createSupabaseServiceClient } from "@/lib/data/supabase/service";
import { mcpResourceUrl } from "@/lib/oauth/config";
import {
  appendRedirectParams,
  isAllowedRedirectUri,
  parseScopes,
  safeInternalPath
} from "@/lib/oauth/security";
import { issueAuthorizationCode } from "@/lib/oauth/tokens";

export const dynamic = "force-dynamic";

type WorkspaceOption = {
  id: string;
  public_id: string;
  name: string;
  organization_id: string;
  organizations:
    | {
        name: string;
        public_id: string;
      }
    | {
        name: string;
        public_id: string;
      }[]
    | null;
};

type AuthorizeParams = {
  responseType: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  scope: string[];
  state?: string;
  resource: string;
};

function htmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function parseAuthorizeParams(url: URL): AuthorizeParams {
  const responseType = url.searchParams.get("response_type") ?? "";
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod = url.searchParams.get("code_challenge_method") ?? "";
  const scope = parseScopes(url.searchParams.get("scope"));
  const state = url.searchParams.get("state") ?? undefined;
  const resource = url.searchParams.get("resource") ?? mcpResourceUrl();

  if (responseType !== "code") {
    throw new Error("response_type must be code.");
  }

  if (!clientId) {
    throw new Error("client_id is required.");
  }

  if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
    throw new Error("redirect_uri is not allowed.");
  }

  if (!codeChallenge || codeChallengeMethod !== "S256") {
    throw new Error("PKCE S256 is required.");
  }

  if (resource !== mcpResourceUrl()) {
    throw new Error("resource must match the MCP endpoint.");
  }

  return {
    responseType,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    scope,
    state,
    resource
  };
}

async function getUser(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    const url = new URL(request.url);
    return {
      user: null,
      loginRedirect: `/login?next=${encodeURIComponent(
        `${url.pathname}${url.search}`
      )}`
    };
  }

  return { user, loginRedirect: null };
}

async function listWorkspaceOptions(userId: string) {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("workspace_memberships")
    .select(
      "workspaces!inner(id, public_id, name, organization_id, organizations(name, public_id))"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return (
    data
      ?.map((row) =>
        Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces
      )
      .filter(Boolean) as WorkspaceOption[]
  ) ?? [];
}

function renderConsentPage(input: {
  params: AuthorizeParams;
  email: string;
  workspaces: WorkspaceOption[];
  error?: string;
}) {
  const selected = input.workspaces[0];
  const workspaceOptions = input.workspaces
    .map((workspace) => {
      const organization = Array.isArray(workspace.organizations)
        ? workspace.organizations[0]
        : workspace.organizations;
      const label = `${organization?.name ?? "Organization"} / ${workspace.name}`;
      return `<option value="${htmlEscape(workspace.public_id)}">${htmlEscape(label)}</option>`;
    })
    .join("");
  const hidden = [
    ["response_type", input.params.responseType],
    ["client_id", input.params.clientId],
    ["redirect_uri", input.params.redirectUri],
    ["code_challenge", input.params.codeChallenge],
    ["code_challenge_method", input.params.codeChallengeMethod],
    ["scope", input.params.scope.join(" ")],
    ["state", input.params.state ?? ""],
    ["resource", input.params.resource]
  ]
    .map(
      ([name, value]) =>
        `<input type="hidden" name="${name}" value="${htmlEscape(value)}" />`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Connect Claude to Morlob</title>
    <style>
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f8fafc; color: #0f172a; }
      main { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }
      section { width: 100%; max-width: 520px; border: 1px solid #d7dde5; background: white; border-radius: 8px; padding: 24px; box-shadow: 0 10px 24px rgb(15 23 42 / 8%); }
      h1 { margin: 0; font-size: 24px; line-height: 1.2; }
      p { color: #475569; line-height: 1.55; }
      dl { display: grid; grid-template-columns: 120px 1fr; gap: 10px 16px; font-size: 14px; }
      dt { color: #64748b; }
      dd { margin: 0; overflow-wrap: anywhere; }
      label { display: block; margin-top: 18px; font-size: 14px; font-weight: 600; }
      select { width: 100%; margin-top: 8px; height: 40px; border: 1px solid #cbd5e1; border-radius: 6px; padding: 0 10px; background: white; }
      .actions { display: flex; gap: 12px; margin-top: 24px; }
      button { height: 40px; border-radius: 6px; border: 1px solid #0f172a; padding: 0 16px; font-weight: 600; cursor: pointer; }
      button[value="approve"] { background: #0f172a; color: white; }
      button[value="deny"] { background: white; color: #0f172a; }
      .error { border: 1px solid #fecaca; background: #fef2f2; color: #991b1b; border-radius: 6px; padding: 10px 12px; }
    </style>
  </head>
  <body>
    <main>
      <section>
        <h1>Connect Claude to Morlob</h1>
        <p>Claude is requesting access to Morlob through the remote MCP connector.</p>
        ${input.error ? `<p class="error">${htmlEscape(input.error)}</p>` : ""}
        <dl>
          <dt>Signed in</dt><dd>${htmlEscape(input.email)}</dd>
          <dt>Client</dt><dd>${htmlEscape(input.params.clientId)}</dd>
          <dt>Scopes</dt><dd>${htmlEscape(input.params.scope.join(" "))}</dd>
          <dt>Redirect</dt><dd>${htmlEscape(input.params.redirectUri)}</dd>
        </dl>
        <form method="post" action="/oauth/authorize">
          ${hidden}
          <label for="workspace_id">Workspace</label>
          <select id="workspace_id" name="workspace_id" required>
            ${workspaceOptions}
          </select>
          <div class="actions">
            <button type="submit" name="decision" value="approve" ${selected ? "" : "disabled"}>Approve</button>
            <button type="submit" name="decision" value="deny">Deny</button>
          </div>
        </form>
      </section>
    </main>
  </body>
</html>`;
}

function htmlResponse(body: string, init?: ResponseInit) {
  return new Response(body, {
    ...init,
    headers: {
      "content-type": "text/html; charset=utf-8",
      ...(init?.headers ?? {})
    }
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = parseAuthorizeParams(url);
    const { user, loginRedirect } = await getUser(request);

    if (!user) {
      return NextResponse.redirect(new URL(loginRedirect, url.origin));
    }

    const supabase = createSupabaseServiceClient();
    const access = await ensureUserAccess(supabase, user);

    if (access.status !== "approved") {
      return htmlResponse("Morlob access is not approved.", { status: 403 });
    }

    const workspaces = await listWorkspaceOptions(user.id);

    return htmlResponse(
      renderConsentPage({
        params,
        email: user.email ?? "",
        workspaces,
        error:
          workspaces.length === 0
            ? "Create or join a Morlob workspace before connecting Claude."
            : undefined
      })
    );
  } catch (error) {
    return htmlResponse(
      error instanceof Error ? htmlEscape(error.message) : "Invalid request.",
      { status: 400 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const redirectUri = String(form.get("redirect_uri") ?? "");
    const state = String(form.get("state") ?? "") || undefined;
    const decision = String(form.get("decision") ?? "");

    if (!redirectUri || !isAllowedRedirectUri(redirectUri)) {
      return htmlResponse("redirect_uri is not allowed.", { status: 400 });
    }

    if (decision === "deny") {
      return NextResponse.redirect(
        appendRedirectParams(redirectUri, {
          error: "access_denied",
          state
        }),
        303
      );
    }

    const url = new URL(request.url);
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") {
        url.searchParams.set(key, value);
      }
    }

    const params = parseAuthorizeParams(url);
    const workspacePublicId = String(form.get("workspace_id") ?? "");
    const { user, loginRedirect } = await getUser(request);

    if (!user) {
      return NextResponse.redirect(
        new URL(safeInternalPath(loginRedirect), new URL(request.url).origin)
      );
    }

    const supabase = createSupabaseServiceClient();
    const access = await ensureUserAccess(supabase, user);

    if (access.status !== "approved") {
      return htmlResponse("Morlob access is not approved.", { status: 403 });
    }

    const { data: membership, error } = await supabase
      .from("workspace_memberships")
      .select(
        "workspace_id, organization_id, workspaces!inner(id, public_id, organization_id)"
      )
      .eq("user_id", user.id)
      .eq("workspaces.public_id", workspacePublicId)
      .maybeSingle<{
        workspace_id: string;
        organization_id: string;
        workspaces:
          | { id: string; public_id: string; organization_id: string }
          | { id: string; public_id: string; organization_id: string }[]
          | null;
      }>();

    if (error) {
      throw error;
    }

    const workspace = Array.isArray(membership?.workspaces)
      ? membership?.workspaces[0]
      : membership?.workspaces;

    if (!membership || !workspace) {
      return htmlResponse("Workspace is not available to this user.", {
        status: 403
      });
    }

    const code = await issueAuthorizationCode(supabase, {
      user_id: user.id,
      organization_id: membership.organization_id,
      workspace_id: membership.workspace_id,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      scope: params.scope,
      resource: params.resource,
      code_challenge: params.codeChallenge,
      code_challenge_method: "S256"
    });

    return NextResponse.redirect(
      appendRedirectParams(params.redirectUri, {
        code,
        state
      }),
      303
    );
  } catch (error) {
    return htmlResponse(
      error instanceof Error ? htmlEscape(error.message) : "Invalid request.",
      { status: 400 }
    );
  }
}

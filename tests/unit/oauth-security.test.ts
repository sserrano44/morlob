import { describe, expect, it } from "vitest";

import {
  appendRedirectParams,
  isAllowedRedirectUri,
  parseScopes,
  safeInternalPath,
  verifyPkceS256
} from "@/lib/oauth/security";

describe("oauth security helpers", () => {
  it("allows Claude and localhost redirect URI forms", () => {
    expect(isAllowedRedirectUri("https://claude.ai/api/mcp/auth_callback")).toBe(
      true
    );
    expect(isAllowedRedirectUri("claude://oauth/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://localhost:3118/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://127.0.0.1:3118/callback")).toBe(true);
    expect(isAllowedRedirectUri("http://example.com/callback")).toBe(false);
  });

  it("rejects unsupported scopes", () => {
    expect(parseScopes("todos:read todos:write")).toEqual([
      "todos:read",
      "todos:write"
    ]);
    expect(() => parseScopes("admin:all")).toThrow("Unsupported scope");
  });

  it("verifies S256 PKCE challenges", () => {
    expect(
      verifyPkceS256(
        "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
      )
    ).toBe(true);
  });

  it("preserves redirect state and blocks open login redirects", () => {
    expect(
      appendRedirectParams("https://claude.ai/api/mcp/auth_callback", {
        code: "abc",
        state: "xyz"
      })
    ).toBe("https://claude.ai/api/mcp/auth_callback?code=abc&state=xyz");
    expect(safeInternalPath("/oauth/authorize?state=abc")).toBe(
      "/oauth/authorize?state=abc"
    );
    expect(safeInternalPath("https://evil.example")).toBe("/app");
  });
});

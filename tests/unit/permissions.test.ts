import { describe, expect, it } from "vitest";

import {
  agentIsUsable,
  hasScope,
  hasWorkspaceAssignment,
  keyIsUsable
} from "@/lib/core/permissions";

describe("permissions", () => {
  it("checks exact and wildcard scopes", () => {
    expect(hasScope(["todos:read"], "todos:read")).toBe(true);
    expect(hasScope(["todos:read"], "todos:write")).toBe(false);
    expect(hasScope(["*"], "files:write")).toBe(true);
  });

  it("rejects revoked and expired keys", () => {
    expect(keyIsUsable({ revoked_at: null, expires_at: null })).toBe(true);
    expect(keyIsUsable({ revoked_at: "2026-05-11T12:00:00Z" })).toBe(false);
    expect(
      keyIsUsable(
        { expires_at: "2026-05-11T12:00:00Z" },
        new Date("2026-05-11T12:01:00Z")
      )
    ).toBe(false);
  });

  it("rejects disabled agents", () => {
    expect(agentIsUsable({ status: "active" })).toBe(true);
    expect(agentIsUsable({ status: "disabled" })).toBe(false);
    expect(agentIsUsable({ status: "archived" })).toBe(false);
  });

  it("requires a non-revoked workspace assignment", () => {
    expect(
      hasWorkspaceAssignment(
        [{ workspace_id: "wsp_a", revoked_at: null }],
        "wsp_a"
      )
    ).toBe(true);
    expect(
      hasWorkspaceAssignment(
        [{ workspace_id: "wsp_a", revoked_at: "2026-05-11T12:00:00Z" }],
        "wsp_a"
      )
    ).toBe(false);
    expect(
      hasWorkspaceAssignment(
        [{ workspace_id: "wsp_a", revoked_at: null }],
        "wsp_b"
      )
    ).toBe(false);
  });
});

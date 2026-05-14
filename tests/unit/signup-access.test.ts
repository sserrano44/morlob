import { describe, expect, it } from "vitest";

import {
  emailIsAllowedForSignup,
  normalizeEmail
} from "@/lib/auth/access";

describe("signup access helpers", () => {
  it("normalizes email addresses", () => {
    expect(normalizeEmail(" Mail@Sserrano.com ")).toBe("mail@sserrano.com");
  });

  it("allows every email when the allowlist is empty", () => {
    expect(emailIsAllowedForSignup("person@example.com", [])).toBe(true);
  });

  it("allows only exact normalized email matches when configured", () => {
    expect(
      emailIsAllowedForSignup(" Mail@Sserrano.com ", ["mail@sserrano.com"])
    ).toBe(true);
    expect(
      emailIsAllowedForSignup("other@sserrano.com", ["mail@sserrano.com"])
    ).toBe(false);
  });
});

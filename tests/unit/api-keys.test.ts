import { describe, expect, it } from "vitest";

import {
  generateApiKey,
  parseApiKey,
  verifyApiKey
} from "@/lib/core/api-keys";

describe("agent API keys", () => {
  it("generates a prefixed key and stores a verifiable one-way hash", () => {
    const key = generateApiKey("mlb");

    expect(key.plaintext).toMatch(/^mlb_[a-f0-9]{16}_[A-Za-z0-9_-]+$/);
    expect(key.hash).not.toContain(key.plaintext);
    expect(verifyApiKey(key.plaintext, key.salt, key.hash)).toBe(true);
    expect(verifyApiKey(`${key.plaintext}x`, key.salt, key.hash)).toBe(false);
  });

  it("parses the lookup prefix without exposing the secret", () => {
    const key = generateApiKey("mlb");
    const parsed = parseApiKey(key.plaintext, "mlb");

    expect(parsed?.prefix).toBe("mlb");
    expect(parsed?.keyPrefix).toBe(key.keyPrefix);
    expect(parseApiKey(key.plaintext, "other")).toBeNull();
  });
});

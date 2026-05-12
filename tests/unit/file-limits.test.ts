import { describe, expect, it } from "vitest";

import { env } from "@/lib/config/env";

describe("file limits", () => {
  it("defaults uploads to 5 MB", () => {
    expect(env.MORLOB_MAX_UPLOAD_BYTES).toBe(5_242_880);
  });
});

import { describe, expect, it } from "vitest";
import { parseManifest } from "../../src/lib/manifest.js";

describe("parseManifest", () => {
  it("accepts an unresolved manifest", () => {
    const manifest = parseManifest({
      version: "0.1.0",
      status: "unresolved",
      frontend: null,
      backend: null,
      systemType: null,
      architectureStyle: null,
      constraints: [],
      qualityProfiles: [],
      lastResolvedAt: null
    });

    expect(manifest.status).toBe("unresolved");
  });
});

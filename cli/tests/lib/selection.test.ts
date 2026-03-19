import { describe, expect, it } from "vitest";
import { resolveTemplatePaths } from "../../src/lib/selection.js";

describe("resolveTemplatePaths", () => {
  it("returns base templates plus resolved overlays", () => {
    const files = resolveTemplatePaths({
      projectPhase: "greenfield",
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith",
      constraints: ["auth"],
      qualityProfiles: [],
      practiceProfiles: [],
      primaryProduct: "",
      targetUsers: [],
      coreEntities: [],
      criticalRisks: [],
      deliveryPriorities: [],
      currentPainPoints: [],
      stabilityConstraints: []
    });

    expect(files).toContain("templates/base/AGENTS.md");
    expect(files).toContain("templates/base/GEMINI.md");
    expect(files).toContain("templates/frontend/next/docs/architecture/frontend.md");
    expect(files).toContain("templates/backend/nest/docs/architecture/backend.md");
    expect(files).toContain("templates/system/internal-tool/docs/system/overview.md");
  });
});

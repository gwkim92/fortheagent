import { describe, expect, it } from "vitest";
import { parseManifest } from "../../src/lib/manifest.js";
import { listTemplateFiles } from "../../src/lib/templates.js";

describe("listTemplateFiles", () => {
  it("returns resolved overlay templates from the package registry", async () => {
    const files = await listTemplateFiles(
      parseManifest({
        version: "0.1.0",
        foundationVersion: "0.1.0",
        status: "resolved",
        projectPhase: "greenfield",
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "monolith",
        constraints: [],
        qualityProfiles: ["ci-basic"],
        practiceProfiles: ["ddd-core"],
        projectContext: {
          primaryProduct: "",
          targetUsers: [],
          coreEntities: [],
          criticalRisks: [],
          deliveryPriorities: [],
          currentPainPoints: [],
          stabilityConstraints: []
        },
        installedProfiles: [
          "base",
          "phase:greenfield",
          "frontend:next",
          "backend:nest",
          "system:internal-tool",
          "architecture:monolith",
          "quality:ci-basic",
          "practice:ddd-core"
        ],
        lastResolvedAt: "2026-03-15T12:00:00.000Z"
      })
    );

    expect(files).toContain("templates/frontend/next/docs/architecture/frontend.md");
    expect(files).toContain("templates/backend/nest/docs/architecture/backend.md");
    expect(files).toContain("templates/system/internal-tool/docs/system/overview.md");
    expect(files).toContain("templates/quality/ci-basic/.github/workflows/ci.yml");
    expect(files).toContain("templates/frontend/next/.claude/rules/frontend.md");
    expect(files).toContain("templates/frontend/next/.cursor/rules/frontend.mdc");
    expect(files).toContain("templates/practice/ddd-core/docs/practices/ddd-core.md");
  });

  it("returns only base templates for unresolved manifests", async () => {
    const files = await listTemplateFiles(
      parseManifest({
        version: "0.1.0",
        foundationVersion: "0.1.0",
        status: "unresolved",
        projectPhase: "greenfield",
        frontend: null,
        backend: null,
        systemType: null,
        architectureStyle: null,
        constraints: [],
        qualityProfiles: [],
        practiceProfiles: [],
        projectContext: {
          primaryProduct: "",
          targetUsers: [],
          coreEntities: [],
          criticalRisks: [],
          deliveryPriorities: [],
          currentPainPoints: [],
          stabilityConstraints: []
        },
        installedProfiles: ["base", "phase:greenfield"],
        lastResolvedAt: null
      })
    );

    expect(files).toContain("templates/base/AGENTS.md");
    expect(files).toContain("templates/base/CLAUDE.md");
    expect(files).toContain("templates/base/GEMINI.md");
    expect(files).toContain("templates/base/.agents/skills/docs-writer/SKILL.md");
    expect(files).toContain("templates/base/.claude/rules/index.md");
    expect(files).toContain("templates/base/.cursor/rules/architecture.mdc");
    expect(files).not.toContain("templates/frontend/next/docs/architecture/frontend.md");
  });
});

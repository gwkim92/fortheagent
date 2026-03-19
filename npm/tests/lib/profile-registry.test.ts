import { describe, expect, it } from "vitest";
import {
  PROFILE_REGISTRY_MIGRATION_TARGET,
  collectKnownOverlayOutputs,
  loadProfileRegistry
} from "../../src/lib/profile-registry.js";

describe("profile registry", () => {
  it("migrates a legacy registry to the current target", () => {
    const result = loadProfileRegistry({
      version: "0.0.0",
      axes: {
        frontend: {
          next: {
            templates: ["templates/frontend/next"],
            outputs: ["docs/architecture/frontend.md"]
          }
        },
        backend: {
          nest: {
            templates: ["templates/backend/nest"],
            outputs: ["docs/architecture/backend.md"]
          }
        },
        systemType: {
          "internal-tool": {
            templates: ["templates/system/internal-tool"],
            outputs: ["docs/system/overview.md"]
          }
        },
        quality: {
          "ci-basic": {
            templates: ["templates/quality/ci-basic"],
            outputs: [".github/workflows/ci.yml"]
          }
        },
        constraints: {
          auth: {
            templates: [],
            outputs: []
          }
        }
      }
    });

    expect(result.needsRewrite).toBe(true);
    expect(result.migratedFrom).toBe("0.0.0");
    expect(result.registry.version).toBe(PROFILE_REGISTRY_MIGRATION_TARGET);
    expect(result.registry.axes.architectureStyle.monolith.outputs).toEqual([]);
    expect(result.registry.axes.practice["ddd-core"].outputs).toEqual([
      "docs/practices/ddd-core.md"
    ]);
  });

  it("collects known overlay outputs from a registry", () => {
    const result = loadProfileRegistry({
      version: "0.0.0",
      axes: {
        frontend: {
          next: {
            templates: ["templates/frontend/next"],
            outputs: ["docs/architecture/frontend.md"]
          }
        },
        backend: {
          nest: {
            templates: ["templates/backend/nest"],
            outputs: ["docs/architecture/backend.md"]
          }
        },
        systemType: {
          "internal-tool": {
            templates: ["templates/system/internal-tool"],
            outputs: ["docs/system/overview.md"]
          }
        },
        quality: {
          "ci-basic": {
            templates: ["templates/quality/ci-basic"],
            outputs: [".github/workflows/ci.yml"]
          }
        },
        constraints: {}
      }
    });

    expect(collectKnownOverlayOutputs(result.registry)).toEqual([
      ".github/workflows/ci.yml",
      "docs/architecture/backend.md",
      "docs/architecture/current-state.md",
      "docs/architecture/frontend.md",
      "docs/architecture/refactor-target.md",
      "docs/engineering/current-delivery-risks.md",
      "docs/engineering/migration-plan.md",
      "docs/practices/ddd-core.md",
      "docs/practices/strict-verification.md",
      "docs/practices/tdd-first.md",
      "docs/system/overview.md"
    ]);
  });
});

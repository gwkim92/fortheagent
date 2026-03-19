import { describe, expect, it } from "vitest";
import {
  buildInstalledProfiles,
  createUnresolvedManifest,
  parseManifest,
  validateManifest
} from "../../src/lib/manifest.js";

const emptyProjectContext = {
  primaryProduct: "",
  targetUsers: [],
  coreEntities: [],
  criticalRisks: [],
  deliveryPriorities: [],
  currentPainPoints: [],
  stabilityConstraints: []
};

describe("manifest", () => {
  it("accepts an unresolved manifest", () => {
    const manifest = parseManifest({
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
      projectContext: emptyProjectContext,
      installedProfiles: ["base", "phase:greenfield"],
      lastResolvedAt: null
    });

    expect(manifest.status).toBe("unresolved");
  });

  it("creates the default unresolved manifest", () => {
    const manifest = createUnresolvedManifest();

    expect(manifest).toMatchObject({
      version: "0.1.0",
      foundationVersion: "0.1.0",
      status: "unresolved",
      projectPhase: "greenfield",
      practiceProfiles: [],
      projectContext: emptyProjectContext,
      installedProfiles: ["base", "phase:greenfield"]
    });
  });

  it("flags unknown resolved profile values", () => {
    const errors = validateManifest(
      parseManifest({
        version: "0.1.0",
        foundationVersion: "0.1.0",
        status: "resolved",
        projectPhase: "greenfield",
        frontend: "unknown-frontend",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "monolith",
        constraints: [],
        qualityProfiles: [],
        practiceProfiles: [],
        projectContext: emptyProjectContext,
        installedProfiles: ["base", "phase:greenfield"],
        lastResolvedAt: "2026-03-15T12:00:00.000Z"
      })
    );

    expect(errors).toContain("Unknown frontend profile: unknown-frontend");
  });

  it("derives canonical installedProfiles for resolved manifests", () => {
    const installedProfiles = buildInstalledProfiles({
      status: "resolved",
      projectPhase: "greenfield",
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "monolith",
      constraints: ["realtime", "auth"],
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["tdd-first"],
      projectContext: emptyProjectContext
    });

    expect(installedProfiles).toEqual([
      "base",
      "phase:greenfield",
      "frontend:next",
      "backend:nest",
      "system:internal-tool",
      "architecture:monolith",
      "quality:ci-basic",
      "practice:tdd-first",
      "constraint:auth",
      "constraint:realtime"
    ]);
  });

  it("flags installedProfiles mismatches", () => {
    const errors = validateManifest(
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
        qualityProfiles: [],
        practiceProfiles: [],
        projectContext: emptyProjectContext,
        installedProfiles: ["base", "phase:greenfield", "frontend:next"],
        lastResolvedAt: "2026-03-15T12:00:00.000Z"
      })
    );

    expect(errors).toContain(
      "Manifest validation failed: missing installedProfiles entries: backend:nest, system:internal-tool, architecture:monolith"
    );
  });

  it("flags installedProfiles canonical ordering issues", () => {
    const errors = validateManifest(
      parseManifest({
        version: "0.1.0",
        foundationVersion: "0.1.0",
        status: "resolved",
        projectPhase: "greenfield",
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "monolith",
        constraints: ["auth", "realtime"],
        qualityProfiles: ["ci-basic"],
        practiceProfiles: ["strict-verification"],
        projectContext: emptyProjectContext,
        installedProfiles: [
          "base",
          "phase:greenfield",
          "frontend:next",
          "backend:nest",
          "system:internal-tool",
          "architecture:monolith",
          "constraint:realtime",
          "constraint:auth",
          "quality:ci-basic",
          "practice:strict-verification"
        ],
        lastResolvedAt: "2026-03-15T12:00:00.000Z"
      })
    );

    expect(errors).toContain(
      "Manifest validation failed: installedProfiles must use canonical order: base, phase:greenfield, frontend:next, backend:nest, system:internal-tool, architecture:monolith, quality:ci-basic, practice:strict-verification, constraint:auth, constraint:realtime"
    );
  });
});

import { describe, expect, it } from "vitest";
import { promptTestInternals } from "../../src/lib/prompt.js";

describe("prompt helpers", () => {
  it("only offers implemented profiles during interactive init", async () => {
    const options = await promptTestInternals.resolvePromptOptions();

    expect(options.frontend).toEqual(["next", "react-spa", "none"]);
    expect(options.backend).toEqual(["nest", "fastify", "serverless", "none"]);
    expect(options.systemType).toEqual([
      "internal-tool",
      "b2b-saas",
      "content-site",
      "api-platform",
      "realtime-app",
      "data-platform"
    ]);
    expect(options.architectureStyle).toEqual([
      "monolith",
      "modular-monolith",
      "service-oriented",
      "event-driven"
    ]);
    expect(options.qualityProfiles).toEqual(["ci-basic"]);
    expect(options.practiceProfiles).toEqual([
      "ddd-core",
      "tdd-first",
      "strict-verification"
    ]);
    expect(options.constraints).toContain("payments");
  });

  it("builds a prompt plan without single-choice auto-selected steps", async () => {
    const options = await promptTestInternals.resolvePromptOptions();
    const steps = promptTestInternals.buildPromptSteps(options);
    const autoSelections = promptTestInternals.collectAutoSelections(options);

    expect(steps).toEqual([
      { kind: "single", label: "projectPhase" },
      { kind: "single", label: "frontend" },
      { kind: "single", label: "backend" },
      { kind: "single", label: "systemType" },
      { kind: "single", label: "architectureStyle" },
      { kind: "multi", label: "constraints" },
      { kind: "multi", label: "qualityProfiles" },
      { kind: "multi", label: "practiceProfiles" },
      { kind: "text", label: "primaryProduct" },
      { kind: "text", label: "targetUsers" },
      { kind: "text", label: "coreEntities" },
      { kind: "text", label: "criticalRisks" },
      { kind: "text", label: "deliveryPriorities" }
    ]);
    expect(autoSelections).toEqual([]);
  });

  it("adds existing-repository follow-up questions only for the existing phase", async () => {
    const options = await promptTestInternals.resolvePromptOptions();
    const steps = promptTestInternals.buildPromptStepsForPhase(options, "existing");

    expect(steps).toContainEqual({ kind: "text", label: "currentPainPoints" });
    expect(steps).toContainEqual({ kind: "text", label: "stabilityConstraints" });
  });

  it("builds the generated file preview from a selection", async () => {
    const files = await promptTestInternals.buildGeneratedFilePreview({
      projectPhase: "greenfield",
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "monolith",
      constraints: ["payments"],
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["ddd-core", "tdd-first", "strict-verification"],
      primaryProduct: "ops dashboard",
      targetUsers: ["internal operators"],
      coreEntities: ["invoice", "workspace"],
      criticalRisks: ["payment reconciliation"],
      deliveryPriorities: ["design-ready docs"],
      currentPainPoints: [],
      stabilityConstraints: []
    });

    expect(files.slice(0, 6)).toEqual([
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      "docs/agents/context-map.md",
      "docs/agents/design-handoff.md",
      "docs/agents/repo-facts.md"
    ]);
    expect(files).toContain("docs/architecture/frontend.md");
    expect(files).toContain("docs/product/constraints/payments.md");
    expect(files).toContain(".github/workflows/ci.yml");
    expect(files.at(-1)).toBe(".agent-foundation/provider-projections.json");
  });

  it("formats numbered options with defaults", () => {
    expect(promptTestInternals.formatNumberedOption("next", 0, false)).toBe("  1. next");
    expect(promptTestInternals.formatNumberedOption("nest", 1, true)).toBe(
      "  2. nest (default)"
    );
  });

  it("maps raw values to user-facing option copy", () => {
    expect(promptTestInternals.formatOptionValue("frontend", "next")).toBe("Next.js");
    expect(promptTestInternals.formatOptionValue("constraints", "payments")).toBe(
      "Payments and Billing"
    );
    expect(promptTestInternals.getOptionCopy("constraints", "payments")).toEqual({
      label: "Payments and Billing",
      description: "Charges, subscriptions, or billing are involved."
    });
  });

  it("infers prompt defaults from repository scan hints", async () => {
    const options = await promptTestInternals.resolvePromptOptions();
    const defaults = promptTestInternals.inferDefaultsFromScan(
      {
        root: "/tmp/demo",
        packageManager: "pnpm",
        installCommand: "pnpm install --frozen-lockfile",
        workspaceLayout: "single-package",
        packageName: "demo",
        scripts: {},
        existingDocs: [],
        hasCi: false,
        ciFiles: [],
        frontendHints: ["react-spa"],
        backendHints: ["fastify"],
        routeHints: [],
        apiHints: [],
        dataHints: [],
        realtimeToolHints: [],
        dataToolHints: [],
        testHints: [],
        systemTypeHints: ["api-platform"],
        architectureStyleHints: ["service-oriented"],
        phaseRecommendation: "existing",
        phaseRecommendationReasons: ["existing repository docs are present"],
        importantFiles: [],
        availableSkills: [],
        hasSkillInstaller: false
      },
      options
    );

    expect(defaults).toEqual({
      projectPhase: "existing",
      frontend: "react-spa",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented"
    });
  });

  it("resolves numbered single-select input", () => {
    const options = ["next", "react-spa", "none"];

    expect(promptTestInternals.resolveOptionInput("1", options)).toBe("next");
    expect(promptTestInternals.resolveOptionInput("2", options)).toBe("react-spa");
    expect(promptTestInternals.resolveOptionInput("none", options)).toBe("none");
    expect(promptTestInternals.resolveOptionInput("9", options)).toBeNull();
  });

  it("resolves numbered multi-select input", () => {
    const options = ["seo", "auth", "payments"];

    expect(promptTestInternals.resolveMultiOptionInput("2,1", options)).toEqual([
      "auth",
      "seo"
    ]);
    expect(promptTestInternals.resolveMultiOptionInput("", options)).toEqual([]);
    expect(promptTestInternals.resolveMultiOptionInput("4", options)).toBeNull();
  });
});

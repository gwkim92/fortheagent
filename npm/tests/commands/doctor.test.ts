import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runDoctor } from "../../src/commands/doctor.js";
import { runInit } from "../../src/commands/init.js";

describe("runDoctor", () => {
  it("reports a missing required file", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    await rm(path.join(cwd, "AGENTS.md"));

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing required file: AGENTS.md");
  });

  it("reports projection parity drift in provider entry files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(
      path.join(cwd, "GEMINI.md"),
      "# Gemini CLI Entry\n\nRead `docs/index.md` only.\n",
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Projection parity mismatch: GEMINI.md is missing required doc reference docs/agents/repo-facts.md"
    );
  });

  it("requires existing-phase current and migration docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented"
    });
    await rm(path.join(cwd, "docs", "architecture", "current-state.md"));

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Missing required file: docs/architecture/current-state.md");
  });

  it("keeps active stack, constraint, and practice docs reachable from startup routers", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith",
      constraints: ["auth"],
      practiceProfiles: ["strict-verification"]
    });

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("docs/architecture/frontend.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/architecture/backend.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/product/constraints/auth.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/practices/strict-verification.md"))
    ).toBe(false);
  });

  it("keeps existing-repository planning docs reachable from startup routers", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "modular-monolith"
    });

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("docs/architecture/current-state.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/architecture/refactor-target.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) =>
        warning.includes("docs/engineering/current-delivery-risks.md")
      )
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/engineering/migration-plan.md"))
    ).toBe(false);
    expect(
      result.warnings.some((warning) => warning.includes("docs/engineering/testing-strategy.md"))
    ).toBe(false);
  });

  it("reports corrupted merge-managed markers", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(path.join(cwd, "AGENTS.md"), "broken\n", "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Corrupted managed markers: AGENTS.md");
    expect(result.repairCommands).toContain(`fortheagent sync --repair --cwd ${cwd}`);
  });

  it("reports missing repository skill frontmatter", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(
      path.join(cwd, ".agents", "skills", "docs-writer", "SKILL.md"),
      "# Docs Writer Skill\n",
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Missing or invalid skill frontmatter: .agents/skills/docs-writer/SKILL.md"
    );
    expect(result.repairCommands).toContain(`fortheagent sync --cwd ${cwd}`);
  });

  it("reports unknown manifest profile values", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      status: string;
      frontend: string | null;
      backend: string | null;
      systemType: string | null;
      architectureStyle: string | null;
      lastResolvedAt: string | null;
    };
    manifest.status = "resolved";
    manifest.frontend = "unknown-frontend";
    manifest.backend = "nest";
    manifest.systemType = "internal-tool";
    manifest.architectureStyle = "monolith";
    manifest.lastResolvedAt = "2026-03-15T12:00:00.000Z";
    await writeFile(`${manifestPath}`, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("Unknown frontend profile: unknown-frontend");
    expect(
      result.errors.some((error) =>
        error.includes("missing installedProfiles entries:")
      )
    ).toBe(true);
  });

  it("validates the repository profile registry copy", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    const registryPath = path.join(cwd, ".agent-foundation", "profile-registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      version: string;
      axes: {
        quality: {
          "ci-basic": {
            templates: string[];
            outputs: string[];
          };
        };
      };
    };
    registry.axes.quality["ci-basic"].outputs = ["/absolute/path.yml"];
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Invalid output path for quality:ci-basic: /absolute/path.yml"
    );
  });

  it("derives required overlay outputs from the repository profile registry", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      qualityProfiles: ["ci-basic"]
    });
    const registryPath = path.join(cwd, ".agent-foundation", "profile-registry.json");
    const registry = JSON.parse(await readFile(registryPath, "utf8")) as {
      version: string;
      axes: {
        frontend: {
          next: {
            templates: string[];
            outputs: string[];
          };
        };
      };
    };
    registry.axes.frontend.next.outputs = ["docs/architecture/frontend-alt.md"];
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Missing required file: docs/architecture/frontend-alt.md"
    );
  });

  it("warns about stale overlay files that are no longer selected", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, frontend: "next", backend: "nest" });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      foundationVersion: string;
      status: string;
      projectPhase: string;
      frontend: string | null;
      backend: string | null;
      systemType: string | null;
      architectureStyle: string | null;
      constraints: string[];
      qualityProfiles: string[];
      practiceProfiles: string[];
      projectContext: {
        primaryProduct: string;
        targetUsers: string[];
        coreEntities: string[];
        criticalRisks: string[];
        deliveryPriorities: string[];
        currentPainPoints: string[];
        stabilityConstraints: string[];
      };
      installedProfiles: string[];
      lastResolvedAt: string | null;
    };
    manifest.status = "unresolved";
    manifest.frontend = null;
    manifest.backend = null;
    manifest.systemType = null;
    manifest.architectureStyle = null;
    manifest.constraints = [];
    manifest.qualityProfiles = [];
    manifest.practiceProfiles = [];
    manifest.projectContext = {
      primaryProduct: "",
      targetUsers: [],
      coreEntities: [],
      criticalRisks: [],
      deliveryPriorities: [],
      currentPainPoints: [],
      stabilityConstraints: []
    };
    manifest.installedProfiles = ["base", "phase:greenfield"];
    manifest.lastResolvedAt = null;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Managed file drift detected: .agent-foundation/context-budget.json"
    );
    expect(result.warnings).toContain(
      "Unexpected managed overlay file present: .claude/rules/frontend.md"
    );
    expect(result.warnings).toContain(
      "Unexpected merge-managed overlay file present: docs/architecture/frontend.md"
    );
    expect(result.warnings).toContain(
      "Unexpected merge-managed overlay file present: docs/architecture/backend.md"
    );
    expect(result.warnings).toContain(
      "Unexpected merge-managed overlay file present: docs/system/overview.md"
    );
    expect(result.repairCommands).toContain(`fortheagent sync --cwd ${cwd}`);
    expect(result.repairCommands).toContain(`fortheagent sync --prune --cwd ${cwd}`);
  });

  it("warns when always-loaded context files exceed budget", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));
    const extraLines = Array.from({ length: 140 }, (_, index) => `extra startup note ${index + 1}`);

    await runInit({ cwd, mode: "deferred" });
    await writeFile(
      path.join(cwd, "AGENTS.md"),
      [
        await readFile(path.join(cwd, "AGENTS.md"), "utf8"),
        "",
        ...extraLines
      ].join("\n"),
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("Context budget warning: AGENTS.md"))
    ).toBe(true);
  });

  it("warns when the startup surface fans out to too many docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(
      path.join(cwd, "AGENTS.md"),
      [
        await readFile(path.join(cwd, "AGENTS.md"), "utf8"),
        "",
        "See also `docs/product/index.md` and `docs/architecture/overview.md` before starting."
      ].join("\n"),
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("Context surface warning: AGENTS.md references")
      )
    ).toBe(true);
  });

  it("warns when the same long guidance line is repeated across multiple docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));
    const repeatedLine =
      "This repeated local guidance line should not appear in many different docs because it wastes context budget and increases instruction duplication across the repository.";

    await runInit({ cwd, mode: "deferred" });

    for (const filePath of [
      "AGENTS.md",
      "CLAUDE.md",
      "docs/index.md",
      "docs/agents/context-map.md"
    ]) {
      await writeFile(
        path.join(cwd, filePath),
        [
          await readFile(path.join(cwd, filePath), "utf8"),
          "",
          repeatedLine
        ].join("\n"),
        "utf8"
      );
    }

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("Context duplication warning"))
    ).toBe(true);
  });

  it("ignores repeated frontmatter metadata when checking duplication warnings", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "modular-monolith",
      constraints: ["auth"],
      practiceProfiles: ["strict-verification"]
    });

    const result = await runDoctor({ cwd });

    expect(
      result.warnings.some((warning) => warning.includes("\"source_of_truth\":"))
    ).toBe(false);
  });

  it("does not warn about duplication for generated subtree area docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await mkdir(path.join(cwd, "apps", "web"), { recursive: true });
    await mkdir(path.join(cwd, "services", "api"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "area-doc-duplication-check",
          private: true,
          workspaces: ["apps/*", "services/*"]
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "apps", "web", "package.json"),
      JSON.stringify({ name: "@check/web", dependencies: { next: "16.0.0" } }, null, 2),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "services", "api", "package.json"),
      JSON.stringify({ name: "@check/api", dependencies: { fastify: "5.0.0" } }, null, 2),
      "utf8"
    );

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "next",
      backend: "fastify",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith"
    });

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) => warning.includes("Context duplication warning"))
    ).toBe(false);
  });

  it("reports workflow state mismatches for missing active work items", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      workflowState: {
        mode: string;
        activeWorkItem: string | null;
      };
    };
    manifest.workflowState = {
      mode: "implementation",
      activeWorkItem: "ship-current-work"
    };
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      "Workflow state mismatch: activeWorkItem points to missing file docs/work/active/ship-current-work.md"
    );
  });

  it("warns when document freshness metadata is stale", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });
    const docsIndexPath = path.join(cwd, "docs", "index.md");
    const staleContent = (await readFile(docsIndexPath, "utf8")).replace(
      /"last_verified": "\d{4}-\d{2}-\d{2}"/,
      '"last_verified": "2025-01-01"'
    );
    await writeFile(docsIndexPath, staleContent, "utf8");

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("Document freshness warning: docs/index.md is stale")
      )
    ).toBe(true);
  });

  it("warns instead of failing when a subtree adapter references extra docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await mkdir(path.join(cwd, "apps", "web", "src", "app"), { recursive: true });
    await mkdir(path.join(cwd, "services", "api", "src", "routes"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "signal-ops",
          private: true,
          workspaces: ["apps/*", "services/*"]
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "apps", "web", "package.json"),
      JSON.stringify(
        {
          name: "@signal-ops/web",
          dependencies: {
            next: "^16.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "services", "api", "package.json"),
      JSON.stringify(
        {
          name: "@signal-ops/api",
          dependencies: {
            fastify: "^5.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "next",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented"
    });

    const adapterPath = path.join(cwd, "apps", "web", "AGENTS.md");
    const adapter = await readFile(adapterPath, "utf8");
    await writeFile(
      adapterPath,
      adapter.replace(
        '"docs/engineering/command-registry.md"\n  ]',
        '"docs/engineering/command-registry.md",\n    "docs/product/index.md"\n  ]'
      ),
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes(
          "Subtree adapter warning: apps/web/AGENTS.md references additional docs beyond the local minimum: docs/product/index.md"
        )
      )
    ).toBe(true);
  });

  it("warns instead of failing when related_docs references a missing optional doc", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({ cwd, mode: "deferred" });

    const docsIndexPath = path.join(cwd, "docs", "index.md");
    const docsIndex = await readFile(docsIndexPath, "utf8");
    await writeFile(
      docsIndexPath,
      docsIndex.replace(
        '"docs/skills/index.md"\n  ]',
        '"docs/skills/index.md",\n    "docs/non-existent.md"\n  ]'
      ),
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("Broken related_docs reference: docs/index.md -> docs/non-existent.md")
      )
    ).toBe(true);
  });

  it("warns when auth and realtime constraints lose executable coverage", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-doctor-"));

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "next",
      backend: "fastify",
      systemType: "realtime-app",
      architectureStyle: "event-driven",
      constraints: ["auth", "realtime"]
    });

    const verificationPath = path.join(cwd, "docs", "engineering", "verification.md");
    const verification = await readFile(verificationPath, "utf8");
    await writeFile(
      verificationPath,
      verification
        .replace(/.*role checks.*\n/g, "")
        .replace(/.*permission boundaries.*\n/g, "")
        .replace(/.*session-scope.*\n/g, "")
        .replace(/.*reconnect behavior.*\n/g, "")
        .replace(/.*ordering guarantees.*\n/g, "")
        .replace(/.*presence accuracy.*\n/g, ""),
      "utf8"
    );

    const runbooksPath = path.join(cwd, "docs", "operations", "runbooks.md");
    const runbooks = await readFile(runbooksPath, "utf8");
    await writeFile(
      runbooksPath,
      runbooks.replace(/.*Realtime incidents.*\n/g, ""),
      "utf8"
    );

    const commandRegistryPath = path.join(cwd, "docs", "engineering", "command-registry.md");
    const commandRegistry = await readFile(commandRegistryPath, "utf8");
    await writeFile(
      commandRegistryPath,
      commandRegistry.replace(/.*Auth-sensitive changes.*\n/g, ""),
      "utf8"
    );

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("auth is selected but docs/engineering/verification.md")
      )
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("auth is selected but docs/engineering/command-registry.md")
      )
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("realtime is selected but docs/engineering/verification.md")
      )
    ).toBe(true);
    expect(
      result.warnings.some((warning) =>
        warning.includes("realtime is selected but docs/operations/runbooks.md")
      )
    ).toBe(true);
  });
});

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "../../src/commands/init.js";
import { runSync } from "../../src/commands/sync.js";

describe("runSync", () => {
  it("updates managed files without overwriting user-owned files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    const agentsPath = path.join(cwd, "AGENTS.md");
    const existing = await readFile(agentsPath, "utf8");
    const updatedAgents = `${existing.replace("Stay in design mode until the design pack is coherent.", "BROKEN")}\nUser notes stay here.\n`;
    await writeFile(agentsPath, updatedAgents, "utf8");
    await writeFile(path.join(cwd, "docs", "project-notes.md"), "keep me\n", "utf8");

    const summary = await runSync({ cwd });

    expect(summary.updated).toContain("AGENTS.md");
    expect(summary.skipped).toContain("docs/project-notes.md");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("docs/index.md");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("User notes stay here.");
  });

  it("reports conflicts for corrupted merge-managed files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(path.join(cwd, "AGENTS.md"), "broken\n", "utf8");

    const summary = await runSync({ cwd });

    expect(summary.updated).not.toContain("AGENTS.md");
    expect(summary.conflicted).toContain("AGENTS.md");
  });

  it("repairs corrupted merge-managed files when repair is requested", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(path.join(cwd, "AGENTS.md"), "broken\n", "utf8");

    const summary = await runSync({ cwd, repair: true });

    expect(summary.conflicted).not.toContain("AGENTS.md");
    expect(summary.updated).toContain("AGENTS.md");
    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/index.md"
    );
  });

  it("supports dry-run without writing files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    const agentsPath = path.join(cwd, "AGENTS.md");
    const existing = await readFile(agentsPath, "utf8");
    await writeFile(
      agentsPath,
      existing.replace("Stay in design mode until the design pack is coherent.", "BROKEN"),
      "utf8"
    );

    const summary = await runSync({ cwd, dryRun: true });

    expect(summary.updated).toContain("AGENTS.md");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("BROKEN");
  });

  it("supports repair dry-run without writing repaired content", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    const agentsPath = path.join(cwd, "AGENTS.md");
    await writeFile(agentsPath, "broken\n", "utf8");

    const summary = await runSync({ cwd, dryRun: true, repair: true });

    expect(summary.updated).toContain("AGENTS.md");
    expect(summary.conflicted).not.toContain("AGENTS.md");
    await expect(readFile(agentsPath, "utf8")).resolves.toBe("broken\n");
  });

  it("detects the repository root from a nested working directory", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));
    const nestedCwd = path.join(cwd, "apps", "web");

    await mkdir(nestedCwd, { recursive: true });
    await writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
    await writeFile(path.join(nestedCwd, "package.json"), "{\"name\":\"web\"}\n", "utf8");
    await runInit({ cwd, mode: "deferred" });

    const agentsPath = path.join(cwd, "AGENTS.md");
    const existing = await readFile(agentsPath, "utf8");
    await writeFile(
      agentsPath,
      existing.replace("Stay in design mode until the design pack is coherent.", "BROKEN"),
      "utf8"
    );

    const summary = await runSync({ cwd: nestedCwd });

    expect(summary.updated).toContain("AGENTS.md");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("docs/index.md");
  });

  it("fails when the selected profile points to a missing package template root", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, frontend: "next", backend: "nest" });
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
    registry.axes.frontend.next.templates = ["templates/frontend/missing-root"];
    await writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, "utf8");

    await expect(runSync({ cwd })).rejects.toThrow(
      "Missing template root in package: templates/frontend/missing-root"
    );
  });

  it("prunes stale managed overlay files when requested", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, frontend: "next", backend: "nest", qualityProfiles: ["ci-basic"] });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      version: string;
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
      installedProfiles: string[];
      lastResolvedAt: string | null;
    };
    manifest.qualityProfiles = [];
    manifest.installedProfiles = [
      "base",
      "phase:greenfield",
      "frontend:next",
      "backend:nest",
      "system:internal-tool",
      "architecture:monolith"
    ];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const summary = await runSync({ cwd, prune: true });

    expect(summary.pruned).toContain(".github/workflows/ci.yml");
    await expect(readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8")).rejects.toThrow();
  });

  it("supports prune dry-run without deleting stale managed overlays", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, frontend: "next", backend: "nest", qualityProfiles: ["ci-basic"] });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      version: string;
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
      installedProfiles: string[];
      lastResolvedAt: string | null;
    };
    manifest.qualityProfiles = [];
    manifest.installedProfiles = [
      "base",
      "phase:greenfield",
      "frontend:next",
      "backend:nest",
      "system:internal-tool",
      "architecture:monolith"
    ];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const summary = await runSync({ cwd, prune: true, dryRun: true });

    expect(summary.pruned).toContain(".github/workflows/ci.yml");
    await expect(
      readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8")
    ).resolves.toContain("name: CI");
  });

  it("backfills the default active work item when syncing an older resolved manifest", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, frontend: "next", backend: "nest" });
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      workflowState: {
        mode: string;
        activeWorkItem: string | null;
      };
    };
    manifest.workflowState.activeWorkItem = null;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const summary = await runSync({ cwd });

    expect(summary.updated).toContain(".agent-foundation/manifest.json");
    await expect(readFile(manifestPath, "utf8")).resolves.toContain(
      "\"activeWorkItem\": \"docs/work/active/0001-initial-design-scope.md\""
    );
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "active", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("Initial Design Scope");
  });

  it("repairs older repository skill files to include YAML frontmatter", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-sync-"));

    await runInit({ cwd, mode: "deferred" });
    const skillPath = path.join(cwd, ".agents", "skills", "docs-writer", "SKILL.md");
    await writeFile(skillPath, "# Docs Writer Skill\n", "utf8");

    const summary = await runSync({ cwd });

    expect(summary.updated).toContain(".agents/skills/docs-writer/SKILL.md");
    await expect(readFile(skillPath, "utf8")).resolves.toContain('name: "docs-writer"');
    await expect(readFile(skillPath, "utf8")).resolves.toContain("Docs Writer Skill");
  });
});

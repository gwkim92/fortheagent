import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "../../src/commands/init.js";
import { runWork } from "../../src/commands/work.js";

describe("runWork", () => {
  it("updates workflow mode and creates a custom active work item doc", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-work-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith"
    });

    const result = await runWork({
      cwd,
      mode: "implementation",
      activeWorkItem: "0002-auth-boundary"
    });

    expect(result.manifest.workflowState.mode).toBe("implementation");
    expect(result.manifest.workflowState.activeWorkItem).toBe(
      "docs/work/active/0002-auth-boundary.md"
    );
    expect(result.updated).toContain(".agent-foundation/manifest.json");
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "active", "0002-auth-boundary.md"),
        "utf8"
      )
    ).resolves.toContain("Active Work Item: Auth Boundary");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoffs", "current.md"), "utf8")
    ).resolves.toContain("Current workflow mode: implementation.");
  });

  it("returns without rewriting when workflow state is unchanged", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-work-"));

    await runInit({ cwd, mode: "deferred" });
    const result = await runWork({ cwd });

    expect(result.updated).toEqual([]);
    expect(result.manifest.workflowState.mode).toBe("design");
    expect(result.manifest.workflowState.activeWorkItem).toBeNull();
  });

  it("archives the current active work item and promotes the next one", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-work-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith"
    });

    const result = await runWork({
      cwd,
      archiveActive: true,
      activeWorkItem: "0002-auth-rollout"
    });

    expect(result.archived).toBe("docs/work/archive/0001-initial-design-scope.md");
    expect(result.manifest.workflowState.activeWorkItem).toBe(
      "docs/work/active/0002-auth-rollout.md"
    );
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "archive", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("## Completion Summary");
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "archive", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("Next active work item: `docs/work/active/0002-auth-rollout.md`.");
    await expect(
      readFile(
        path.join(cwd, ".agent-foundation", "handoffs", "archive", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("## Completion Summary");
    await expect(
      readFile(
        path.join(cwd, ".agent-foundation", "handoffs", "archive", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("Follow-up moved to `docs/work/active/0002-auth-rollout.md`.");
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "active", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).rejects.toThrow();
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "active", "0002-auth-rollout.md"),
        "utf8"
      )
    ).resolves.toContain("Active Work Item: Auth Rollout");
  });
});

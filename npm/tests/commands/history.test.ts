import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runHistory } from "../../src/commands/history.js";
import { runInit } from "../../src/commands/init.js";
import { runWork } from "../../src/commands/work.js";

describe("runHistory", () => {
  it("reports the current work item and archived snapshots in timeline order", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-history-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith"
    });
    await runWork({
      cwd,
      mode: "implementation",
      activeWorkItem: "0002-auth-boundary"
    });
    await runWork({
      cwd,
      archiveActive: true,
      activeWorkItem: "0003-auth-rollout"
    });

    const result = await runHistory({ cwd });

    expect(result.ok).toBe(true);

    if (!result.ok) {
      return;
    }

    expect(result.workflowMode).toBe("implementation");
    expect(result.activeWorkItem).toBe("docs/work/active/0003-auth-rollout.md");
    expect(result.archivedCount).toBe(1);
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toMatchObject({
      state: "current",
      workItemPath: "docs/work/active/0003-auth-rollout.md",
      workItemTitle: "Active Work Item: Auth Rollout",
      handoffPath: ".agent-foundation/handoffs/current.md",
      handoffPresent: true
    });
    expect(result.entries[1]).toMatchObject({
      state: "archived",
      workItemPath: "docs/work/archive/0002-auth-boundary.md",
      workItemTitle: "Active Work Item: Auth Boundary",
      handoffPath: ".agent-foundation/handoffs/archive/0002-auth-boundary.md",
      handoffPresent: true
    });
    expect(result.entries[1]?.completionSummary).toContain("Archived automatically");
  });
});

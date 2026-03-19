import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runStatus } from "../../src/commands/status.js";
import { runCreate } from "../../src/commands/create.js";

describe("runStatus", () => {
  it("returns missing before initialization", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-status-"));
    const result = await runStatus({ cwd });

    expect(result).toEqual({
      ok: false,
      status: "missing",
      reason: "forTheAgent manifest not found"
    });
  });

  it("returns the resolved manifest state after create", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-status-"));

    await runCreate({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: []
      }
    });

    const result = await runStatus({ cwd });

    expect(result).toMatchObject({
      ok: true,
      status: "resolved",
      readiness: "ready",
      frontend: "next",
      backend: "nest",
      workflowMode: "design",
      activeWorkItem: "docs/work/active/0001-initial-design-scope.md"
    });
  });
});

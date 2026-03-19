import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runDoctor } from "../../src/commands/doctor.js";
import { runInit } from "../../src/commands/init.js";

describe("runDoctor", () => {
  it("reports a missing required file", async () => {
    const cwd = path.resolve(import.meta.dirname, "..", "fixtures", "missing-agents");
    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(false);
    expect(result.errors[0]).toContain("AGENTS.md");
    expect(result.repairCommand).toContain("fortheagent-cli");
  });

  it("warns when discovery has not been completed", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-doctor-"));
    await runInit({ cwd, mode: "deferred" });

    const result = await runDoctor({ cwd });

    expect(result.ok).toBe(true);
    expect(result.warnings).toEqual([]);
    expect(result.repairCommands).toEqual([]);
    expect(result.repairCommand).toBeNull();
  });
});

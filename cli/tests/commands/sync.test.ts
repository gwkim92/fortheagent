import { describe, expect, it } from "vitest";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init.js";
import { runSync } from "../../src/commands/sync.js";

describe("runSync", () => {
  it("updates managed files without overwriting user-owned files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-sync-"));

    await runInit({ cwd, mode: "deferred" });
    await writeFile(path.join(cwd, "AGENTS.md"), "broken\n", "utf8");
    await writeFile(path.join(cwd, "docs", "project-notes.md"), "keep me\n", "utf8");

    const summary = await runSync({ cwd });

    expect(summary.skipped).toContain("docs/project-notes.md");
    expect(summary.conflicted).toContain("AGENTS.md");
    expect(summary.pruned).toEqual([]);
    expect(summary.migratedLegacy).toBe(false);
    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toBe("broken\n");
  });
});

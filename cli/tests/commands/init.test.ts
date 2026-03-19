import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init.js";

describe("runInit", () => {
  it("creates the shared foundation files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-"));

    await runInit({ cwd, mode: "deferred" });

    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/agents/repo-facts.md"
    );
    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      ".agent-foundation/handoffs/current.md"
    );
    await expect(readFile(path.join(cwd, "CLAUDE.md"), "utf8")).resolves.toContain(
      "@docs/agents/repo-facts.md"
    );
    await expect(readFile(path.join(cwd, "GEMINI.md"), "utf8")).resolves.toContain(
      "docs/agents/repo-facts.md"
    );
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"unresolved\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "context-budget.json"), "utf8")
    ).resolves.toContain("\"GEMINI.md\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "provider-projections.json"), "utf8")
    ).resolves.toContain("\"entryFile\": \"GEMINI.md\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoff", "design-ready.md"), "utf8")
    ).resolves.toContain("Design-Ready Handoff");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoffs", "current.md"), "utf8")
    ).resolves.toContain("Current Handoff");
  });
});

import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("interactive entry", () => {
  it("opens the launcher and runs Guided Setup from mode 1", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-interactive-entry-"));
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    const result = await execa("node", [cliPath], {
      cwd,
      env: {
        ...process.env,
        FORTHEAGENT_ANSWER_SET: JSON.stringify({
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: ["auth"]
        })
      },
      input: "1\n"
    });

    expect(result.stdout).toContain("forTheAgent");
    expect(result.stdout).toContain("[1] Guided Setup");
    expect(result.stdout).toContain("[2] Ask forTheAgent");
    expect(result.stdout).toContain("Guided Setup");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
    await expect(readFile(path.join(cwd, "CLAUDE.md"), "utf8")).resolves.toContain(
      "@docs/agents/repo-facts.md"
    );
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoff", "design-ready.md"), "utf8")
    ).resolves.toContain("Design-Ready Handoff");
  });

  it("supports direct setup entry without opening the launcher menu", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-interactive-entry-direct-"));
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    await execa("node", [cliPath, "setup"], {
      cwd,
      env: {
        ...process.env,
        FORTHEAGENT_ANSWER_SET: JSON.stringify({
          projectPhase: "greenfield",
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: ["auth"],
          qualityProfiles: ["ci-basic"],
          practiceProfiles: ["strict-verification"],
          primaryProduct: "Ops portal",
          targetUsers: ["ops"],
          coreEntities: ["ticket"],
          criticalRisks: ["permission drift"],
          deliveryPriorities: ["safety"]
        })
      }
    });

    await expect(readFile(path.join(cwd, "CLAUDE.md"), "utf8")).resolves.toContain(
      "@docs/agents/repo-facts.md"
    );
  });
});

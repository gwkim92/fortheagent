import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildSessionContext, RepositoryResolutionError } from "../../src/lib/repository-context.js";
import { runCreate } from "../../src/commands/create.js";
import { runInit } from "../../src/commands/init.js";

describe("repository context", () => {
  it("builds a session context from a resolved repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-context-"));

    await runCreate({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    const context = await buildSessionContext(cwd, "Review the architecture");

    expect(context.manifest.status).toBe("resolved");
    expect(context.documents.some((document) => document.path === "AGENTS.md")).toBe(true);
    expect(
      context.documents.some(
        (document) => document.path === "docs/work/active/0001-initial-design-scope.md"
      )
    ).toBe(true);
    expect(context.startupPrompt).toContain("frontend: next");
    expect(context.userPrompt).toBe("Review the architecture");
  });

  it("fails with a next step for unresolved repositories", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-context-"));
    await runInit({ cwd, mode: "deferred" });

    await expect(buildSessionContext(cwd)).rejects.toMatchObject<RepositoryResolutionError>({
      message: "Repository is initialized but discovery has not been completed",
      nextStep: "fortheagent-cli"
    });
  });
});

import { describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runInit } from "../../src/commands/init.js";
import { runStart, StartCommandError } from "../../src/commands/start.js";

describe("start command", () => {
  it("guides discovery when the repository is unresolved", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-start-"));
    await runInit({ cwd, mode: "deferred" });

    await expect(
      runStart({
        cwd,
        provider: "openai-api",
        prompt: "Review the repository",
        dryRun: true
      })
    ).rejects.toMatchObject<StartCommandError>({
      message: "Repository is initialized but discovery has not been completed",
      nextStep: "fortheagent-cli"
    });
  });
});

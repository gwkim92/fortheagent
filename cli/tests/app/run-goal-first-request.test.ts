import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { runGoalFirstRequest } from "../../src/app/run-goal-first-request.js";

describe("runGoalFirstRequest", () => {
  let foundationHome = "";

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
      foundationHome = "";
    }
  });

  it("auto-runs Guided Setup before entering the fortheagent session", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-goal-first-"));
    let stdout = "";

    await runGoalFirstRequest({
      cwd,
      prompt: "gd",
      setupAnswerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "content-site",
        architectureStyle: "monolith",
        constraints: []
      },
      streams: {
        input: Readable.from(["/exit\n"]),
        output: new Writable({
          write(chunk, _encoding, callback) {
            stdout += chunk.toString();
            callback();
          }
        })
      }
    });

    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
    expect(stdout).toContain("Ask forTheAgent");
    expect(stdout).toContain("Setup needed first");
    expect(stdout).toContain("Continuing with: gd");
    expect(stdout).toContain("Generated project-specific docs");
  });
});

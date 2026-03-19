import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { runGuidedSetup } from "../../src/app/run-guided-setup.js";
import { runCreate } from "../../src/commands/create.js";
import { runInit } from "../../src/commands/init.js";

function createStreams(input: string) {
  let stdout = "";

  return {
    streams: {
      input: Readable.from([input]),
      output: new Writable({
        write(chunk, _encoding, callback) {
          stdout += chunk.toString();
          callback();
        }
      })
    },
    getOutput() {
      return stdout;
    }
  };
}

describe("runGuidedSetup", () => {
  it("bootstraps an empty repository through structured questions", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-guided-setup-"));
    const io = createStreams("");

    await runGuidedSetup({
      cwd,
      streams: io.streams,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
    expect(io.getOutput()).toContain("No forTheAgent manifest found");
    expect(io.getOutput()).toContain("Repository is now configured.");
  });

  it("completes discovery for an unresolved repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-guided-discover-"));
    const io = createStreams("");

    await runInit({
      cwd,
      mode: "deferred"
    });

    await runGuidedSetup({
      cwd,
      streams: io.streams,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
    expect(io.getOutput()).toContain("This repository still needs discovery.");
    expect(io.getOutput()).toContain("Discovery completed.");
  });

  it("offers maintenance actions for a resolved repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-guided-maintenance-"));
    const io = createStreams("2\n");

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

    await runGuidedSetup({
      cwd,
      streams: io.streams
    });

    expect(io.getOutput()).toContain("This repository is already configured.");
    expect(io.getOutput()).toContain("Managed files synced.");
  });
});

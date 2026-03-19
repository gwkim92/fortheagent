import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { runApp } from "../../src/app/run-app.js";
import { runCreate } from "../../src/commands/create.js";
import { runLogin } from "../../src/commands/login.js";

async function writeExecutable(filePath: string, body: string): Promise<void> {
  await writeFile(filePath, body, "utf8");
  await chmod(filePath, 0o755);
}

describe("runApp free text", () => {
  let foundationHome = "";

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    delete process.env.FOUNDATION_ARG_LOG;
    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
      foundationHome = "";
    }
  });

  it("routes arbitrary free text into the fortheagent session and attaches the default provider inline", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-app-agent-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "fortheagent-app-agent-bin-"));
    foundationHome = await mkdtemp(path.join(tmpdir(), "fortheagent-app-agent-home-"));
    const argLog = path.join(binDir, "codex-args.json");
    let stdout = "";

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

    await writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
writeFileSync(process.env.FOUNDATION_ARG_LOG, JSON.stringify(args));
const outputIndex = args.indexOf("-o");
if (outputIndex !== -1 && args[outputIndex + 1]) {
  writeFileSync(args[outputIndex + 1], "codex reply");
}
console.log(JSON.stringify({ type: "item.completed", item: { type: "agent_message", text: "codex reply" } }));
console.log(JSON.stringify({ type: "turn.completed" }));
`
    );

    process.env.FOUNDATION_HOME = foundationHome;
    process.env.FOUNDATION_ARG_LOG = argLog;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;

    await runLogin({
      provider: "codex-local",
      setDefault: true
    });

    await runApp({
      argv: ["--cwd", cwd, "expand architecture docs for auth and seo"],
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

    const argv = JSON.parse(await readFile(argLog, "utf8")) as string[];
    expect(argv.at(-1)).toContain("forTheAgent workflow: documentation-planning");
    expect(argv.at(-1)).toContain("expand architecture docs for auth and seo");
    expect(stdout).toContain("Ask forTheAgent");
    expect(stdout).toContain("connect on demand");
    expect(stdout).toContain("Codex connected.");
  });

  it("lets initial provider prompts hit fortheagent built-in workflows first", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-app-provider-gd-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "fortheagent-app-gd-bin-"));
    foundationHome = await mkdtemp(path.join(tmpdir(), "fortheagent-app-gd-home-"));
    const argLog = path.join(binDir, "codex-args.json");
    let stdout = "";

    await runCreate({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "content-site",
        architectureStyle: "monolith",
        constraints: []
      }
    });

    await writeExecutable(
      path.join(binDir, "codex"),
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
writeFileSync(process.env.FOUNDATION_ARG_LOG, JSON.stringify(process.argv.slice(2)));
`
    );

    process.env.FOUNDATION_HOME = foundationHome;
    process.env.FOUNDATION_ARG_LOG = argLog;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;

    await runApp({
      argv: ["--cwd", cwd, "codex", "gd"],
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

    await expect(readFile(argLog, "utf8")).rejects.toThrow();
    expect(stdout).toContain("Generated project-specific docs");
    await expect(readFile(path.join(cwd, "docs/agents/project-discovery.md"), "utf8")).resolves.toContain(
      "Discovery is resolved for this repository."
    );
  });
});

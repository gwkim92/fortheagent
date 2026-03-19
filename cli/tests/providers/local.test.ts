import { afterEach, describe, expect, it } from "vitest";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCreate } from "../../src/commands/create.js";
import { buildSessionContext } from "../../src/lib/repository-context.js";
import { createSessionHistory } from "../../src/lib/session.js";
import { createLocalProviderAdapter } from "../../src/providers/local.js";

async function writeExecutable(filePath: string, body: string): Promise<void> {
  await writeFile(filePath, body, "utf8");
  await chmod(filePath, 0o755);
}

describe("local providers", () => {
  let foundationHome = "";

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    delete process.env.FOUNDATION_ARG_LOG;
    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
      foundationHome = "";
    }
  });

  it("sends Codex turns through codex exec --json with write-enabled defaults", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-local-codex-repo-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "fortheagent-local-codex-bin-"));
    foundationHome = await mkdtemp(path.join(tmpdir(), "fortheagent-local-codex-home-"));
    const argLog = path.join(binDir, "codex-args.json");

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

    const adapter = createLocalProviderAdapter({
      id: "codex-local",
      executableName: "codex"
    });
    await adapter.login({});

    const context = await buildSessionContext(cwd);
    const result = await adapter.sendTurn(
      context,
      {
        history: createSessionHistory(context),
        userMessage: "gd"
      },
      {}
    );

    const argv = JSON.parse(await readFile(argLog, "utf8")) as string[];
    expect(result.responseText).toBe("codex reply");
    expect(argv[0]).toBe("exec");
    expect(argv).toContain("--json");
    expect(argv).toContain("-s");
    expect(argv).toContain("workspace-write");
    expect(argv).toContain('-c');
    expect(argv).toContain('approval_policy="never"');
    expect(argv.at(-1)).toContain("USER: gd");
  });

  it("sends Claude turns through print stream-json mode with appended system prompt", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-local-claude-repo-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "fortheagent-local-claude-bin-"));
    foundationHome = await mkdtemp(path.join(tmpdir(), "fortheagent-local-claude-home-"));
    const argLog = path.join(binDir, "claude-args.json");

    await runCreate({
      cwd,
      answerSet: {
        frontend: "react-spa",
        backend: "fastify",
        systemType: "api-platform",
        architectureStyle: "service-oriented",
        constraints: ["realtime"]
      }
    });

    await writeExecutable(
      path.join(binDir, "claude"),
      `#!/usr/bin/env node
import { writeFileSync } from "node:fs";
const args = process.argv.slice(2);
writeFileSync(process.env.FOUNDATION_ARG_LOG, JSON.stringify(args));
console.log(JSON.stringify({
  type: "assistant",
  message: {
    content: [{ type: "text", text: "claude reply" }]
  }
}));
console.log(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "claude reply" }));
`
    );

    process.env.FOUNDATION_HOME = foundationHome;
    process.env.FOUNDATION_ARG_LOG = argLog;
    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ""}`;

    const adapter = createLocalProviderAdapter({
      id: "claude-local",
      executableName: "claude"
    });
    await adapter.login({});

    const context = await buildSessionContext(cwd);
    const result = await adapter.sendTurn(
      context,
      {
        history: createSessionHistory(context),
        userMessage: "Explain this repo"
      },
      {}
    );

    const argv = JSON.parse(await readFile(argLog, "utf8")) as string[];
    expect(result.responseText).toBe("claude reply");
    expect(argv).toContain("-p");
    expect(argv).toContain("--output-format");
    expect(argv).toContain("stream-json");
    expect(argv).toContain("--permission-mode");
    expect(argv).toContain("acceptEdits");
    expect(argv).toContain("--append-system-prompt");
    expect(argv.at(-1)).toContain("USER: Explain this repo");
  });
});

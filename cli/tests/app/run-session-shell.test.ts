import { afterEach, describe, expect, it } from "vitest";
import { appendFileSync } from "node:fs";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PassThrough, Writable } from "node:stream";
import { runCreate } from "../../src/commands/create.js";
import { runLogin } from "../../src/commands/login.js";
import { buildSessionContext } from "../../src/lib/repository-context.js";
import { runSessionShell } from "../../src/app/run-session-shell.js";

async function writeExecutable(filePath: string, body: string): Promise<void> {
  await writeFile(filePath, body, "utf8");
  await chmod(filePath, 0o755);
}

describe("runSessionShell", () => {
  let foundationHome = "";

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    delete process.env.FOUNDATION_ARG_LOG;
    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
      foundationHome = "";
    }
  });

  it("routes documentation drafting chat to the provider on demand and keeps slash commands in fortheagent", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-session-repo-"));
    const binDir = await mkdtemp(path.join(tmpdir(), "fortheagent-session-bin-"));
    foundationHome = await mkdtemp(path.join(tmpdir(), "fortheagent-session-home-"));
    const argLog = path.join(binDir, "codex-args.log");
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
import { appendFileSync, writeFileSync } from "node:fs";
const args = process.argv.slice(2);
appendFileSync(process.env.FOUNDATION_ARG_LOG, JSON.stringify(args) + "\\n");
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

    const input = new PassThrough();
    const queuedInputs = [
      "/work done 0002-auth-boundary\n",
      "/history\n",
      "expand architecture docs for auth and seo\n",
      "/status\n",
      "/clear\n",
      "/exit\n"
    ];
    const shellPromise = runSessionShell({
      cwd,
      sessionContext: await buildSessionContext(cwd),
      streams: {
        input,
        output: new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            stdout += text;

            if (text.includes("fortheagent> ")) {
              const nextInput = queuedInputs.shift();

              if (nextInput) {
                queueMicrotask(() => {
                  input.write(nextInput);

                  if (queuedInputs.length === 0) {
                    input.end();
                  }
                });
              }
            }

            callback();
          }
        })
      }
    });

    await shellPromise;

    const loggedCalls = (await readFile(argLog, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as string[]);

    expect(loggedCalls).toHaveLength(1);
    expect(loggedCalls[0]?.at(-1)).toContain("forTheAgent workflow: documentation-planning");
    expect(loggedCalls[0]?.at(-1)).toContain("Original user request:");
    expect(loggedCalls[0]?.at(-1)).toContain("expand architecture docs for auth and seo");
    expect(loggedCalls[0]?.at(-1)).toContain("docs/work/active/0002-auth-boundary.md");
    expect(stdout).toContain("connect on demand");
    expect(stdout).toContain("archived: docs/work/archive/0001-initial-design-scope.md");
    expect(stdout).toContain("Workflow timeline");
    expect(stdout).toContain("archivedCount: 1");
    expect(stdout).toContain("current: Active Work Item: Auth Boundary");
    expect(stdout).toContain("archived: Active Work Item: Initial Design Scope");
    expect(stdout).toContain("summary: Archived automatically");
    expect(stdout).toContain("workflowMode: design");
    expect(stdout).toContain("activeWorkItem: docs/work/active/0002-auth-boundary.md");
    expect(stdout).toContain("Codex connected.");
    expect(stdout).toContain("documentation planning");
    expect(stdout).toContain("status:");
    expect(stdout).toContain("resolved");
    expect(stdout).toContain("Conversation cleared.");
    await expect(
      readFile(path.join(cwd, "docs", "work", "archive", "0001-initial-design-scope.md"), "utf8")
    ).resolves.toContain("\"load_policy\": \"archive\"");
    await expect(
      readFile(
        path.join(cwd, ".agent-foundation", "handoffs", "archive", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("\"load_policy\": \"archive\"");
  }, 10000);

  it("redirects code-generation asks back to documentation scope without calling the provider", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-session-scope-repo-"));
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

    const input = new PassThrough();
    const queuedInputs = ["build a landing page\n", "/exit\n"];
    const shellPromise = runSessionShell({
      cwd,
      sessionContext: await buildSessionContext(cwd),
      streams: {
        input,
        output: new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            stdout += text;

            if (text.includes("fortheagent> ")) {
              const nextInput = queuedInputs.shift();

              if (nextInput) {
                queueMicrotask(() => {
                  input.write(nextInput);

                  if (queuedInputs.length === 0) {
                    input.end();
                  }
                });
              }
            }

            callback();
          }
        })
      }
    });

    await shellPromise;

    expect(stdout).toContain("Scope clarification");
    expect(stdout).toContain("forTheAgent does not scaffold application code");
    expect(stdout).not.toContain("Codex connected.");
  });

  it("handles gd as a fortheagent workflow without calling the provider", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-session-gd-repo-"));
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

    const input = new PassThrough();
    const queuedInputs = ["gd\n", "/exit\n"];
    const shellPromise = runSessionShell({
      cwd,
      sessionContext: await buildSessionContext(cwd),
      streams: {
        input,
        output: new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            stdout += text;

            if (text.includes("fortheagent> ")) {
              const nextInput = queuedInputs.shift();

              if (nextInput) {
                queueMicrotask(() => {
                  input.write(nextInput);

                  if (queuedInputs.length === 0) {
                    input.end();
                  }
                });
              }
            }

            callback();
          }
        })
      }
    });

    await shellPromise;

    await expect(readFile(path.join(cwd, "docs/agents/project-discovery.md"), "utf8")).resolves.toContain(
      "Discovery is resolved for this repository."
    );
    expect(stdout).toContain("Generated project-specific docs");
  });

  it("explains the repository without calling the provider", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-session-summary-repo-"));
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

    const input = new PassThrough();
    const queuedInputs = ["explain this repository\n", "/exit\n"];
    const shellPromise = runSessionShell({
      cwd,
      sessionContext: await buildSessionContext(cwd),
      streams: {
        input,
        output: new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            stdout += text;

            if (text.includes("fortheagent> ")) {
              const nextInput = queuedInputs.shift();

              if (nextInput) {
                queueMicrotask(() => {
                  input.write(nextInput);

                  if (queuedInputs.length === 0) {
                    input.end();
                  }
                });
              }
            }

            callback();
          }
        })
      }
    });

    await shellPromise;

    expect(stdout).toContain("This is a resolved forTheAgent repository.");
    expect(stdout).toContain("Project type: `internal-tool`");
    expect(stdout).toContain("Stack: frontend `next` and backend `nest`");
  });

  it("reviews a bootstrap-only repository locally before escalating to AI", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-session-review-repo-"));
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

    const input = new PassThrough();
    const queuedInputs = ["review auth flow\n", "/exit\n"];
    const shellPromise = runSessionShell({
      cwd,
      sessionContext: await buildSessionContext(cwd),
      streams: {
        input,
        output: new Writable({
          write(chunk, _encoding, callback) {
            const text = chunk.toString();
            stdout += text;

            if (text.includes("fortheagent> ")) {
              const nextInput = queuedInputs.shift();

              if (nextInput) {
                queueMicrotask(() => {
                  input.write(nextInput);

                  if (queuedInputs.length === 0) {
                    input.end();
                  }
                });
              }
            }

            callback();
          }
        })
      }
    });

    await shellPromise;

    expect(stdout).toContain("Repository review");
    expect(stdout).toContain("The repository is still bootstrap-only");
    expect(stdout).toContain("bootstrap-only");
  });
});

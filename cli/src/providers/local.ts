import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, type ChildProcess } from "node:child_process";
import { findExecutable } from "../lib/find-executable.js";
import { formatHistoryForTurn } from "../lib/session.js";
import {
  readProviderConfig,
  removeProviderConfig,
  type ProviderConfig,
  upsertProviderConfig
} from "../lib/provider-store.js";
import type {
  ProviderAdapter,
  ProviderStatus,
  ProviderTurnEvent,
  ProviderTurnOptions,
  ProviderTurnResult
} from "./types.js";

type LocalProviderId = "codex-local" | "claude-local";

async function emitEvent(
  options: ProviderTurnOptions,
  event: ProviderTurnEvent
): Promise<void> {
  await options.onEvent?.(event);
}

function readHeaderValue(input: unknown, key: string): string | null {
  if (!input || typeof input !== "object" || !(key in input)) {
    return null;
  }

  const value = (input as Record<string, unknown>)[key];
  return typeof value === "string" ? value : null;
}

function extractCodexAgentText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const type = readHeaderValue(payload, "type");
  if (type !== "item.completed") {
    return null;
  }

  const item = (payload as Record<string, unknown>).item;
  if (!item || typeof item !== "object") {
    return null;
  }

  if (readHeaderValue(item, "type") !== "agent_message") {
    return null;
  }

  return readHeaderValue(item, "text");
}

function extractCodexToolActivity(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const item = (payload as Record<string, unknown>).item;
  if (!item || typeof item !== "object") {
    return null;
  }

  const command = readHeaderValue(item, "command");
  if (!command) {
    return null;
  }

  return command;
}

function extractClaudeAssistantText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const type = readHeaderValue(payload, "type");
  if (type !== "assistant") {
    return null;
  }

  const message = (payload as Record<string, unknown>).message;
  if (!message || typeof message !== "object") {
    return null;
  }

  const content = (message as Record<string, unknown>).content;
  if (!Array.isArray(content)) {
    return null;
  }

  const chunks = content
    .map((entry) =>
      entry && typeof entry === "object" ? readHeaderValue(entry, "text") ?? "" : ""
    )
    .filter(Boolean);

  return chunks.length > 0 ? chunks.join("\n") : null;
}

function extractClaudeResultError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const type = readHeaderValue(payload, "type");
  if (type !== "result") {
    return null;
  }

  const isError = (payload as Record<string, unknown>).is_error;
  if (isError !== true) {
    return null;
  }

  return readHeaderValue(payload, "result") ?? "Claude provider request failed";
}

function extractClaudeToolActivity(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const type = readHeaderValue(payload, "type");
  if (type !== "system") {
    return null;
  }

  return readHeaderValue(payload, "subtype");
}

function waitForClose(child: ChildProcess): Promise<number> {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code) => {
      resolve(code ?? 0);
    });
  });
}

async function runBufferedProcess(config: {
  executablePath: string;
  argv: string[];
  cwd: string;
  options: ProviderTurnOptions;
  parseJsonLine(line: string): Promise<void>;
}): Promise<{ exitCode: number; stderr: string }> {
  const child = spawn(config.executablePath, config.argv, {
    cwd: config.cwd,
    stdio: ["ignore", "pipe", "pipe"]
  });
  let stdoutBuffer = "";
  let stderr = "";
  let parseQueue = Promise.resolve();

  child.stdout?.on("data", (chunk: Buffer | string) => {
    stdoutBuffer += chunk.toString();
    const lines = stdoutBuffer.split("\n");
    stdoutBuffer = lines.pop() ?? "";

    for (const line of lines.map((entry) => entry.trim()).filter(Boolean)) {
      parseQueue = parseQueue.then(() => config.parseJsonLine(line));
    }
  });

  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += chunk.toString();
  });

  const exitCode = await waitForClose(child);
  await parseQueue;

  if (stdoutBuffer.trim()) {
    await config.parseJsonLine(stdoutBuffer.trim());
  }

  if (exitCode !== 0) {
    await emitEvent(config.options, {
      type: "error",
      message: stderr.trim() || `Provider process exited with code ${exitCode}`
    });
  }

  return { exitCode, stderr };
}

function buildCodexPrompt(
  history: import("../lib/session.js").SessionMessage[],
  userMessage: string
): string {
  return formatHistoryForTurn(history, userMessage);
}

function buildClaudePrompt(
  history: import("../lib/session.js").SessionMessage[],
  userMessage: string
): string {
  const conversationOnly = history.filter((message) => message.role !== "system");
  return formatHistoryForTurn(conversationOnly, userMessage);
}

export function createLocalProviderAdapter(options: {
  id: LocalProviderId;
  executableName: string;
}): ProviderAdapter {
  async function buildStatus(): Promise<ProviderStatus> {
    const executablePath = await findExecutable(options.executableName);
    const config = await readProviderConfig();
    const stored = config.providers[options.id];
    const configured = stored?.kind === "local";
    const resolvedExecutablePath =
      stored?.kind === "local" ? stored.executablePath : executablePath;

    return {
      id: options.id,
      kind: "local",
      installed: Boolean(executablePath),
      configured,
      authenticated: configured,
      isDefault: config.defaultProvider === options.id,
      detail: executablePath
        ? configured
          ? "ready"
          : "local CLI available"
        : `${options.executableName} executable not found`,
      executablePath: resolvedExecutablePath ?? null
    };
  }

  return {
    id: options.id,
    kind: "local",
    detect: buildStatus,
    status: buildStatus,
    async login() {
      const executablePath = await findExecutable(options.executableName);

      if (!executablePath) {
        throw new Error(`Unable to find ${options.executableName} on PATH`);
      }

      const providerConfig: ProviderConfig = {
        id: options.id,
        kind: "local",
        executablePath
      };

      await upsertProviderConfig(providerConfig);
      return buildStatus();
    },
    async logout() {
      await removeProviderConfig(options.id);
    },
    async sendTurn(sessionContext, input, turnOptions): Promise<ProviderTurnResult> {
      const config = await readProviderConfig();
      const stored = config.providers[options.id];
      const executablePath =
        stored?.kind === "local"
          ? stored.executablePath
          : await findExecutable(options.executableName);

      if (!executablePath) {
        throw new Error(`Provider ${options.id} is not configured`);
      }

      const tempDir = await mkdtemp(path.join(tmpdir(), `fortheagent-${options.id}-`));
      const outputPath = path.join(tempDir, "response.txt");
      let responseText = "";
      let providerError: string | null = null;

      try {
        let argv: string[];

        if (options.id === "codex-local") {
          const prompt = buildCodexPrompt(input.history, input.userMessage);
          argv = [
            "exec",
            "--json",
            "-o",
            outputPath,
            "-C",
            sessionContext.cwd,
            "--skip-git-repo-check",
            "-s",
            "workspace-write",
            "-c",
            'approval_policy="never"',
            prompt
          ];

          if (turnOptions.dryRun) {
            return {
              provider: options.id,
              kind: "local",
              request: {
                argv,
                prompt
              },
              responseText: ""
            };
          }

          await emitEvent(turnOptions, {
            type: "status",
            message: "Sending turn to Codex"
          });

          const { exitCode, stderr } = await runBufferedProcess({
            executablePath,
            argv,
            cwd: sessionContext.cwd,
            options: turnOptions,
            async parseJsonLine(line) {
              const payload = JSON.parse(line) as unknown;
              const text = extractCodexAgentText(payload);

              if (text) {
                responseText = text;
                await emitEvent(turnOptions, {
                  type: "text-delta",
                  text
                });
              }

              const toolActivity = extractCodexToolActivity(payload);
              if (toolActivity) {
                await emitEvent(turnOptions, {
                  type: "tool-activity",
                  message: toolActivity
                });
              }
            }
          });

          try {
            const finalText = (await readFile(outputPath, "utf8")).trim();
            if (finalText) {
              responseText = finalText;
            }
          } catch {
            // The JSON event stream can still provide a complete response.
          }

          if (exitCode !== 0) {
            throw new Error(stderr.trim() || `Provider process exited with code ${exitCode}`);
          }

          await emitEvent(turnOptions, { type: "done" });

          return {
            provider: options.id,
            kind: "local",
            request: {
              argv,
              outputPath
            },
            responseText
          };
        }

        const systemPrompt = input.history.find((message) => message.role === "system")?.content ??
          sessionContext.startupPrompt;
        const prompt = buildClaudePrompt(input.history, input.userMessage);
        argv = [
          "-p",
          "--verbose",
          "--output-format",
          "stream-json",
          "--permission-mode",
          "acceptEdits",
          "--append-system-prompt",
          systemPrompt,
          prompt
        ];

        if (turnOptions.dryRun) {
          return {
            provider: options.id,
            kind: "local",
            request: {
              argv,
              prompt,
              systemPrompt
            },
            responseText: ""
          };
        }

        await emitEvent(turnOptions, {
          type: "status",
          message: "Sending turn to Claude"
        });

        const { exitCode, stderr } = await runBufferedProcess({
          executablePath,
          argv,
          cwd: sessionContext.cwd,
          options: turnOptions,
          async parseJsonLine(line) {
            const payload = JSON.parse(line) as unknown;
            const text = extractClaudeAssistantText(payload);

            if (text) {
              responseText = text;
              await emitEvent(turnOptions, {
                type: "text-delta",
                text
              });
            }

            const toolActivity = extractClaudeToolActivity(payload);
            if (toolActivity) {
              await emitEvent(turnOptions, {
                type: "tool-activity",
                message: toolActivity
              });
            }

            providerError = extractClaudeResultError(payload) ?? providerError;
          }
        });

        if (providerError) {
          throw new Error(providerError);
        }

        if (exitCode !== 0) {
          throw new Error(stderr.trim() || `Provider process exited with code ${exitCode}`);
        }

        await emitEvent(turnOptions, { type: "done" });

        return {
          provider: options.id,
          kind: "local",
          request: {
            argv
          },
          responseText
        };
      } finally {
        await rm(tempDir, { recursive: true, force: true });
      }
    }
  };
}

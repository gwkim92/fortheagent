import { runStatus } from "../commands/status.js";
import type { TerminalStreams } from "../lib/terminal.js";
import { buildSessionContext } from "../lib/repository-context.js";
import type { PromptAnswerSet } from "../lib/prompt.js";
import type { ProviderId } from "../providers/types.js";
import { runGuidedSetup } from "./run-guided-setup.js";
import { runSessionShell } from "./run-session-shell.js";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

export async function runProviderMode(options: {
  cwd: string;
  provider?: ProviderId;
  prompt?: string | null;
  streams?: TerminalStreams;
  setupAnswerSet?: PromptAnswerSet | PromptAnswerSet[];
}): Promise<void> {
  const output = options.streams?.output ?? process.stdout;

  writeLine(output, "Ask forTheAgent");
  writeLine(output, `Repository: ${options.cwd}`);
  writeLine(output);

  let status = await runStatus({ cwd: options.cwd });

  if (!status.ok || status.status !== "resolved") {
    writeLine(output, "This repository is not ready yet. Launching Guided Setup first.");
    writeLine(output);
    await runGuidedSetup({
      cwd: options.cwd,
      streams: options.streams,
      answerSet: options.setupAnswerSet
    });
    writeLine(output);
    status = await runStatus({ cwd: options.cwd });
  }

  if (!status.ok || status.status !== "resolved") {
    throw new Error("Unable to prepare the repository for forTheAgent.");
  }

  const sessionContext = await buildSessionContext(options.cwd);

  await runSessionShell({
    cwd: options.cwd,
    provider: options.provider ?? null,
    sessionContext,
    initialMessage: options.prompt,
    streams: options.streams
  });
}

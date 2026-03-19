import type { PromptAnswerSet } from "../lib/prompt.js";
import { buildSessionContext } from "../lib/repository-context.js";
import type { ProviderId } from "../providers/types.js";
import { runStatus } from "../commands/status.js";
import { runGuidedSetup } from "./run-guided-setup.js";
import { runSessionShell } from "./run-session-shell.js";
import { promptForText, type TerminalStreams } from "../lib/terminal.js";
import {
  renderKeyValueLines,
  renderNoticePanel,
  renderPanel,
  renderPromptLabel
} from "./chrome.js";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

export async function runGoalFirstRequest(options: {
  cwd: string;
  prompt?: string | null;
  preferredProvider?: ProviderId | null;
  streams?: TerminalStreams;
  setupAnswerSet?: PromptAnswerSet | PromptAnswerSet[];
}): Promise<void> {
  const output = options.streams?.output ?? process.stdout;
  let requestedWork = options.prompt?.trim() || null;

  writeLine(
    output,
    renderPanel({
      title: "Ask forTheAgent",
      subtitle: "Describe the documentation help you want",
      lines: [
        ...renderKeyValueLines([
          ["Repository", options.cwd],
          ["Mode", "Built-ins first, provider on demand"]
        ]),
        {
          text: "This mode is for requests like explaining the repo, refreshing docs, or reviewing the current foundation.",
          tone: "subtle"
        },
        {
          text: "If the repository is not ready yet, forTheAgent will set it up first and then come back to your request.",
          tone: "subtle"
        }
      ]
    })
  );
  writeLine(output);

  if (!requestedWork && options.streams?.input && options.streams?.output) {
    requestedWork =
      (
        await promptForText(
          renderPromptLabel("What do you want help with? (optional) "),
          options.streams
        )
      ).trim() || null;
    writeLine(output);
  }

  let status = await runStatus({ cwd: options.cwd });

  if (!status.ok || status.status !== "resolved") {
    writeLine(
      output,
      renderNoticePanel({
        title: "Setup needed first",
        message: "This repository is not ready yet, so forTheAgent will prepare the docs foundation first.",
        details: requestedWork
          ? [`After setup, it will continue with: ${requestedWork}`]
          : ["After setup, it will open the Ask forTheAgent session."]
      })
    );
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

  if (requestedWork) {
    writeLine(
      output,
      renderNoticePanel({
        title: "Resuming your request",
        message: `Continuing with: ${requestedWork}`
      })
    );
    writeLine(output);
  }

  const sessionContext = await buildSessionContext(options.cwd);

  await runSessionShell({
    cwd: options.cwd,
    provider: options.preferredProvider ?? null,
    sessionContext,
    initialMessage: requestedWork,
    streams: options.streams
  });
}

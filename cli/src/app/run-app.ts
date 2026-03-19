import path from "node:path";
import { renderHomeScreen } from "./home-screen.js";
import { routeHomeInput } from "./intent-router.js";
import { runGuidedSetup } from "./run-guided-setup.js";
import { runGoalFirstRequest } from "./run-goal-first-request.js";
import {
  promptForMenuSelection,
  promptForText,
  type TerminalStreams
} from "../lib/terminal.js";

const help = [
  "Usage: fortheagent-cli",
  "",
  "fortheagent-cli opens an interactive launcher in the current directory.",
  "Direct commands are also available for automation and shell-first workflows.",
  "",
  "Top-level flows:",
  "  1. Guided Setup",
  "     Prepare or repair the repository without using an LLM provider.",
  "  2. Ask forTheAgent",
  "     Describe the work you want. forTheAgent uses built-in workflows first",
  "     and connects a provider only when an AI backend is actually needed.",
  "",
  "You can also type a direct request like:",
  "  fortheagent-cli setup",
  "  fortheagent-cli gd",
  "  fortheagent-cli explain this repository",
  "  fortheagent-cli review auth flow",
  "  fortheagent-cli codex",
  "  fortheagent-cli claude review auth flow",
  "",
  "Direct commands:",
  "  fortheagent-cli init",
  "  fortheagent-cli init --mode deferred",
  "  fortheagent-cli sync",
  "  fortheagent-cli doctor",
  "  fortheagent-cli status",
  "  fortheagent-cli history",
  "  fortheagent-cli work --mode implementation --active-work-item 0002-auth-boundary",
  "  fortheagent-cli work --archive-active --active-work-item 0003-auth-rollout",
  "",
  "Built-in session workflows include:",
  "  gd",
  "  explain this repository",
  "  architecture",
  "  next steps",
  "  review this repository",
  "",
  "Inside the forTheAgent session, slash commands such as /help, /status, /history, /sync,",
  "and /exit stay inside forTheAgent instead of being sent to a provider.",
  "",
  "Current directory is used by default."
].join("\n");

type AppOptions = {
  argv?: string[];
  streams?: TerminalStreams;
};

type LauncherOptions = {
  cwd: string;
  initialInput: string | null;
  help: boolean;
};

type LauncherSelection = "setup" | "ask" | "type";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function parseLauncherOptions(argv: string[] = []): LauncherOptions {
  let cwd = process.cwd();
  let help = false;
  const freeText: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      help = true;
      continue;
    }

    if (token === "--cwd") {
      cwd = path.resolve(argv[index + 1] ?? cwd);
      index += 1;
      continue;
    }

    freeText.push(token);
  }

  return {
    cwd,
    initialInput: freeText.length > 0 ? freeText.join(" ").trim() : null,
    help
  };
}

export async function runApp(options: AppOptions = {}): Promise<number> {
  const launcher = parseLauncherOptions(options.argv);
  const output = options.streams?.output ?? process.stdout;

  if (launcher.help) {
    writeLine(output, help);
    return 0;
  }

  if (!launcher.initialInput) {
    writeLine(output, renderHomeScreen(launcher.cwd));
    writeLine(output);
  }

  let currentInput = launcher.initialInput;

  while (true) {
    if (!currentInput && !launcher.initialInput) {
      const selected = await promptForMenuSelection<LauncherSelection>({
        title: "Select a mode",
        streams: options.streams,
        fallbackPrompt: "Choose a mode: ",
        options: [
          {
            label: "[1] Guided Setup",
            value: "setup",
            keywords: ["1", "setup", "guided"]
          },
          {
            label: "[2] Ask forTheAgent",
            value: "ask",
            keywords: ["2", "ask", "agent"]
          },
          {
            label: "[3] Type work directly",
            value: "type",
            keywords: ["3", "type", "work"]
          }
        ]
      });

      writeLine(output);

      if (selected === "setup") {
        await runGuidedSetup({
          cwd: launcher.cwd,
          streams: options.streams
        });
        return 0;
      }

      if (selected === "ask") {
        await runGoalFirstRequest({
          cwd: launcher.cwd,
          streams: options.streams
        });
        return 0;
      }

      currentInput = await promptForText("work> ", options.streams);
    }

    const routed = routeHomeInput(
      currentInput ??
        (await promptForText("work> ", options.streams))
    );

    if (routed.kind === "invalid") {
      writeLine(output, "Type 1 or 2, or describe what you want to do.");
      currentInput = null;
      continue;
    }

    if (routed.kind === "setup") {
      await runGuidedSetup({
        cwd: launcher.cwd,
        streams: options.streams
      });
      return 0;
    }

    await runGoalFirstRequest({
      cwd: launcher.cwd,
      preferredProvider: routed.preferredProvider,
      prompt: routed.prompt,
      streams: options.streams
    });
    return 0;
  }
}

import { runDiscover } from "./discover.js";
import type { PromptAnswerSet } from "../lib/prompt.js";
import type { TerminalStreams } from "../lib/terminal.js";

export async function runCreate(options: {
  cwd: string;
  answerSet?: PromptAnswerSet | PromptAnswerSet[];
  streams?: TerminalStreams;
}) {
  return runDiscover(options);
}

import { createSession, type PromptAnswerSet } from "../lib/prompt.js";
import { buildQuestions, type Question } from "../lib/questions.js";
import { manifestToSelectionDefaults, readManifest } from "../lib/current-selection.js";
import type { TerminalStreams } from "../lib/terminal.js";
import { runInit } from "./init.js";

export type DiscoverPreview = {
  questions: Question[];
};

export function previewDiscover(): DiscoverPreview {
  return {
    questions: buildQuestions()
  };
}

export async function runDiscover(options: {
  cwd: string;
  answerSet?: PromptAnswerSet | PromptAnswerSet[];
  streams?: TerminalStreams;
}) {
  const manifest = await readManifest(options.cwd);
  const session = createSession({
    answerSet: options.answerSet,
    defaults: manifestToSelectionDefaults(manifest),
    streams: options.streams
  });
  const selection = await session.run();

  return runInit({
    cwd: options.cwd,
    mode: "interactive",
    selection
  });
}

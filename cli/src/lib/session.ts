import type { SessionContext } from "./repository-context.js";

export type SessionMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function buildProviderSystemPrompt(sessionContext: SessionContext): string {
  return [
    sessionContext.startupPrompt,
    "",
    "Provider session contract:",
    "- Read the repository contract before making major changes.",
    "- You may infer short or ambiguous user inputs and proceed.",
    "- File edits and command execution are allowed when needed.",
    "- Slash commands are handled by forTheAgent and are not part of the provider prompt."
  ].join("\n");
}

export function createSessionHistory(sessionContext: SessionContext): SessionMessage[] {
  return [
    {
      role: "system",
      content: buildProviderSystemPrompt(sessionContext)
    }
  ];
}

export function formatHistoryForTurn(history: SessionMessage[], userMessage: string): string {
  const lines = history.map((message) => `${message.role.toUpperCase()}: ${message.content}`);
  lines.push(`USER: ${userMessage}`);
  lines.push("");
  lines.push("Respond with the next assistant message for this conversation.");
  return lines.join("\n\n");
}

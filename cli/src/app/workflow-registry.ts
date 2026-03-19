import type { ProviderId } from "../providers/types.js";

export type LauncherWorkflowIntent =
  | {
      kind: "setup";
      prompt: string | null;
    }
  | {
      kind: "agent";
      prompt: string | null;
      preferredProvider: ProviderId | null;
    }
  | {
      kind: "invalid";
    };

const providerKeywords: Array<{ id: ProviderId; keyword: string }> = [
  { id: "codex-local", keyword: "codex" },
  { id: "claude-local", keyword: "claude" },
  { id: "openai-api", keyword: "openai" },
  { id: "anthropic-api", keyword: "anthropic" },
  { id: "hosted-oauth", keyword: "oauth" },
  { id: "hosted-oauth", keyword: "hosted-oauth" }
];

function stripLeadingKeyword(input: string, keyword: string): string | null {
  const normalized = input.trim();
  const lower = normalized.toLowerCase();

  if (lower === keyword) {
    return "";
  }

  if (lower.startsWith(`${keyword} `)) {
    return normalized.slice(keyword.length).trim();
  }

  return null;
}

export function routeWorkflowRequest(input: string): LauncherWorkflowIntent {
  const normalized = input.trim();
  const lower = normalized.toLowerCase();

  if (!normalized) {
    return { kind: "invalid" };
  }

  if (
    lower === "1" ||
    lower === "setup" ||
    lower.startsWith("setup ") ||
    lower === "guided" ||
    lower.startsWith("guided ") ||
    lower === "no llm" ||
    lower.startsWith("no llm ")
  ) {
    const prompt =
      lower.startsWith("setup ") ? normalized.slice("setup".length).trim() :
      lower.startsWith("guided ") ? normalized.slice("guided".length).trim() :
      lower.startsWith("no llm ") ? normalized.slice("no llm".length).trim() :
      "";

    return {
      kind: "setup",
      prompt: prompt || null
    };
  }

  if (lower === "2" || lower === "agent" || lower === "ask" || lower === "chat") {
    return {
      kind: "agent",
      prompt: null,
      preferredProvider: null
    };
  }

  for (const provider of providerKeywords) {
    const remainder = stripLeadingKeyword(normalized, provider.keyword);

    if (remainder !== null) {
      return {
        kind: "agent",
        preferredProvider: provider.id,
        prompt: remainder || null
      };
    }
  }

  return {
    kind: "agent",
    prompt: normalized,
    preferredProvider: null
  };
}

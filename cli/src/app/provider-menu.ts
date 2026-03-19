import type { ProviderId } from "../providers/types.js";
import {
  getProviderAccent,
  renderBrandTitle,
  renderPanel,
  renderProviderName
} from "./chrome.js";

export const providerOptions: Array<{ id: ProviderId; label: string; keywords: string[] }> = [
  {
    id: "codex-local",
    label: "Codex",
    keywords: ["1", "codex"]
  },
  {
    id: "claude-local",
    label: "Claude",
    keywords: ["2", "claude"]
  },
  {
    id: "openai-api",
    label: "OpenAI API",
    keywords: ["3", "openai"]
  },
  {
    id: "anthropic-api",
    label: "Anthropic API",
    keywords: ["4", "anthropic"]
  },
  {
    id: "hosted-oauth",
    label: "Hosted OAuth",
    keywords: ["5", "oauth", "hosted-oauth"]
  }
];

export function renderProviderMenu(statuses: Array<{
  id: ProviderId;
  configured: boolean;
  authenticated: boolean;
  detail: string;
}>): string {
  const lines: Array<{ text: string; tone?: "body" | "subtle" }> = providerOptions.map((option) => {
    const status = statuses.find((entry) => entry.id === option.id);
    const readiness =
      status?.configured && status.authenticated ? "ready" : status?.detail ?? "not configured";

    return {
      text: `${option.keywords[0]}. ${renderProviderName(option.label)}  ${readiness}`,
      tone: "body" as const
    };
  });

  lines.push({
    text: "Use ↑ ↓ and Enter, or type a provider name in non-TTY mode.",
    tone: "subtle"
  });

  return renderPanel({
    title: renderBrandTitle("Provider Selection"),
    subtitle: "Attach an AI backend only when local workflows need it",
    lines,
    accent: getProviderAccent("oauth")
  });
}

export function resolveProviderInput(input: string): ProviderId | null {
  const normalized = input.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  for (const option of providerOptions) {
    if (option.keywords.some((keyword) => normalized === keyword || normalized.startsWith(`${keyword} `))) {
      return option.id;
    }
  }

  return null;
}

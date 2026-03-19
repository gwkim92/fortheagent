import { createLocalProviderAdapter } from "./local.js";
import { createHostedOauthAdapter } from "./oauth.js";
import { createAnthropicAdapter, createOpenAiAdapter } from "./remote.js";
import type { ProviderAdapter, ProviderId } from "./types.js";

const providerAdapters: ProviderAdapter[] = [
  createLocalProviderAdapter({
    id: "codex-local",
    executableName: "codex"
  }),
  createLocalProviderAdapter({
    id: "claude-local",
    executableName: "claude"
  }),
  createOpenAiAdapter(),
  createAnthropicAdapter(),
  createHostedOauthAdapter()
];

export function listProviderAdapters(): ProviderAdapter[] {
  return [...providerAdapters];
}

export function getProviderAdapter(providerId: ProviderId): ProviderAdapter {
  const provider = providerAdapters.find((entry) => entry.id === providerId);

  if (!provider) {
    throw new Error(`Unknown provider: ${providerId}`);
  }

  return provider;
}

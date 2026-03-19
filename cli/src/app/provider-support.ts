import { runLogin } from "../commands/login.js";
import { runProviders } from "../commands/providers.js";
import { readProviderConfig } from "../lib/provider-store.js";
import {
  promptForMenuSelection,
  promptForText,
  type TerminalQuestion,
  type TerminalStreams
} from "../lib/terminal.js";
import type { ProviderId } from "../providers/types.js";
import { providerOptions, renderProviderMenu, resolveProviderInput } from "./provider-menu.js";
import {
  getProviderAccent,
  renderFieldPrompt,
  renderNoticePanel,
  renderPanel,
  renderPromptLabel,
  renderProviderName
} from "./chrome.js";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

type PromptContext = {
  streams?: TerminalStreams;
  question?: TerminalQuestion;
};

async function askText(message: string, context: PromptContext = {}): Promise<string> {
  if (context.question) {
    return context.question(renderPromptLabel(message));
  }

  return promptForText(renderPromptLabel(message), context.streams);
}

async function askField(config: {
  title: string;
  field: string;
  step: number;
  total: number;
  prompt: string;
  hint?: string;
  context: PromptContext;
}): Promise<string> {
  const output = config.context.streams?.output ?? process.stdout;
  writeLine(
    output,
    renderFieldPrompt({
      title: config.title,
      field: config.field,
      step: config.step,
      total: config.total,
      hint: config.hint
    })
  );
  return askText(config.prompt, config.context);
}

export function formatProviderLabel(provider: ProviderId): string {
  return providerOptions.find((option) => option.id === provider)?.label ?? provider;
}

export async function ensureProviderConfiguration(
  provider: ProviderId,
  context: PromptContext = {}
): Promise<void> {
  const output = context.streams?.output ?? process.stdout;
  const label = formatProviderLabel(provider);
  const accent = getProviderAccent(label);

  const showReady = (details: string[] = []): void => {
    writeLine(
      output,
      renderNoticePanel({
        title: "Provider Ready",
        message: `${label} is ready.`,
        details,
        accent
      })
    );
  };

  if (provider === "codex-local" || provider === "claude-local") {
    await runLogin({
      provider,
      setDefault: true
    });
    showReady(["The local CLI bridge is configured and set as the default provider."]);
    return;
  }

  if (provider === "openai-api") {
    await runLogin({
      provider,
      setDefault: true,
      loginOptions: {
        apiKeyEnv: "OPENAI_API_KEY",
        streams: context.streams
      }
    });
    showReady(["API key login succeeded and recommended defaults were stored."]);
    return;
  }

  if (provider === "anthropic-api") {
    await runLogin({
      provider,
      setDefault: true,
      loginOptions: {
        apiKeyEnv: "ANTHROPIC_API_KEY",
        streams: context.streams
      }
    });
    showReady(["API key login succeeded and recommended defaults were stored."]);
    return;
  }

  const config = await readProviderConfig();
  const current = config.providers["hosted-oauth"];
  writeLine(
    output,
    renderPanel({
      title: "Hosted OAuth Login",
      subtitle: "OpenAI-compatible OAuth backend",
      lines: [
        {
          text: "Configure the OAuth endpoints and model used for provider-backed doc work."
        },
        {
          text: "Press Enter to keep an existing value when this provider was already configured.",
          tone: "subtle"
        },
        { text: "Scopes are optional and can be comma-separated.", tone: "subtle" }
      ],
      accent
    })
  );
  writeLine(output);

  const clientId = await askField({
    title: "Hosted OAuth Login",
    field: "Client ID",
    step: 1,
    total: 6,
    prompt: "Hosted OAuth client id: ",
    hint: current?.kind === "oauth" ? `Current: ${current.clientId}` : undefined,
    context
  });
  const authorizeUrl = await askField({
    title: "Hosted OAuth Login",
    field: "Authorize URL",
    step: 2,
    total: 6,
    prompt: "Hosted OAuth authorize URL: ",
    hint: current?.kind === "oauth" ? `Current: ${current.authorizeUrl}` : undefined,
    context
  });
  const tokenUrl = await askField({
    title: "Hosted OAuth Login",
    field: "Token URL",
    step: 3,
    total: 6,
    prompt: "Hosted OAuth token URL: ",
    hint: current?.kind === "oauth" ? `Current: ${current.tokenUrl}` : undefined,
    context
  });
  const apiBaseUrl = await askField({
    title: "Hosted OAuth Login",
    field: "API base URL",
    step: 4,
    total: 6,
    prompt: "Hosted OAuth API base URL: ",
    hint: current?.kind === "oauth" ? `Current: ${current.apiBaseUrl}` : undefined,
    context
  });
  const model = await askField({
    title: "Hosted OAuth Login",
    field: "Model",
    step: 5,
    total: 6,
    prompt: "Hosted OAuth model: ",
    hint: current?.kind === "oauth" ? `Current: ${current.model}` : undefined,
    context
  });
  const rawScopes = await askField({
    title: "Hosted OAuth Login",
    field: "Scopes",
    step: 6,
    total: 6,
    prompt: "Hosted OAuth scopes (comma-separated, optional): ",
    hint:
      current?.kind === "oauth"
        ? `Current: ${current.scopes.join(", ") || "none"}`
        : "Optional",
    context
  });

  const resolvedClientId = clientId.trim() || (current?.kind === "oauth" ? current.clientId : "");
  const resolvedAuthorizeUrl =
    authorizeUrl.trim() || (current?.kind === "oauth" ? current.authorizeUrl : "");
  const resolvedTokenUrl = tokenUrl.trim() || (current?.kind === "oauth" ? current.tokenUrl : "");
  const resolvedApiBaseUrl =
    apiBaseUrl.trim() || (current?.kind === "oauth" ? current.apiBaseUrl : "");
  const resolvedModel = model.trim() || (current?.kind === "oauth" ? current.model : "");
  const resolvedScopes = (rawScopes.trim()
    ? rawScopes
    : current?.kind === "oauth"
      ? current.scopes.join(", ")
      : ""
  )
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);

  writeLine(
    output,
    renderPanel({
      title: "Hosted OAuth Summary",
      subtitle: "Review before the browser-based OAuth flow starts",
      lines: [
        { text: `clientId: ${resolvedClientId || "missing"}` },
        { text: `authorizeUrl: ${resolvedAuthorizeUrl || "missing"}` },
        { text: `tokenUrl: ${resolvedTokenUrl || "missing"}` },
        { text: `apiBaseUrl: ${resolvedApiBaseUrl || "missing"}` },
        { text: `model: ${resolvedModel || "missing"}` },
        { text: `scopes: ${resolvedScopes.join(", ") || "none"}`, tone: "subtle" }
      ],
      accent
    })
  );

  await runLogin({
    provider,
    setDefault: true,
    loginOptions: {
      clientId: resolvedClientId,
      authorizeUrl: resolvedAuthorizeUrl,
      tokenUrl: resolvedTokenUrl,
      apiBaseUrl: resolvedApiBaseUrl,
      model: resolvedModel,
      streams: context.streams,
      scopes: resolvedScopes
    }
  });
  showReady(["OAuth tokens were captured and this provider is now the default backend."]);
}

export async function selectProvider(context: PromptContext = {}): Promise<ProviderId> {
  const output = context.streams?.output ?? process.stdout;
  const providers = await runProviders();

  if (context.question) {
    writeLine(output, renderProviderMenu(providers.providers));
    writeLine(output);

    while (true) {
      const answer = await askText("Choose a provider: ", context);
      const resolved = resolveProviderInput(answer);

      if (resolved) {
        return resolved;
      }

      writeLine(output, "Choose 1-5 or type a provider name.");
    }
  }

  return promptForMenuSelection<ProviderId>({
    title: "Select a provider",
    streams: context.streams,
    fallbackPrompt: "Choose a provider: ",
    options: providers.providers.map((provider, index) => ({
      label: `[${index + 1}] ${renderProviderName(formatProviderLabel(provider.id))} (${provider.configured && provider.authenticated ? "ready" : provider.detail})`,
      value: provider.id,
      keywords: [String(index + 1), provider.id, formatProviderLabel(provider.id).toLowerCase()]
    }))
  });
}

export async function resolveProviderSelection(
  input: string | undefined,
  context: PromptContext = {}
): Promise<ProviderId> {
  if (input) {
    const resolved = resolveProviderInput(input);

    if (resolved) {
      return resolved;
    }
  }

  const config = await readProviderConfig();

  if (config.defaultProvider) {
    return config.defaultProvider;
  }

  return selectProvider(context);
}

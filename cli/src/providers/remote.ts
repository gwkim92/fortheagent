import type {
  ProviderAdapter,
  ProviderStatus,
  ProviderTurnOptions,
  ProviderTurnResult
} from "./types.js";
import {
  readProviderConfig,
  readProviderCredentials,
  removeProviderConfig,
  removeProviderCredential,
  resolveProviderDefaults,
  type ProviderConfig,
  upsertProviderConfig,
  upsertProviderCredential
} from "../lib/provider-store.js";
import { promptForMenuSelection, promptForText } from "../lib/terminal.js";
import type { SessionMessage } from "../lib/session.js";
import {
  getProviderAccent,
  renderFieldPrompt,
  renderPanel,
  renderPromptLabel
} from "../app/chrome.js";

type FetchFn = typeof fetch;

function buildConversationMessages(
  history: SessionMessage[],
  userMessage: string
): Array<{ role: "user" | "assistant"; content: string }> {
  return [
    ...history
      .filter((message) => message.role === "user" || message.role === "assistant")
      .map((message) => ({
        role: message.role as "user" | "assistant",
        content: message.content
      })),
    {
      role: "user",
      content: userMessage
    }
  ];
}

function resolveSystemPrompt(
  history: SessionMessage[],
  fallbackPrompt: string
): string {
  return history.find((message) => message.role === "system")?.content ?? fallbackPrompt;
}

async function emitStatus(
  options: ProviderTurnOptions,
  message: string
): Promise<void> {
  await options.onEvent?.({
    type: "status",
    message
  });
}

async function emitDone(options: ProviderTurnOptions): Promise<void> {
  await options.onEvent?.({
    type: "done"
  });
}

function requireApiKeyConfig(
  providerId: "openai-api" | "anthropic-api"
): Promise<{
  config: Extract<ProviderConfig, { kind: "api-key" }>;
  apiKey: string;
  isDefault: boolean;
}> {
  return Promise.all([readProviderConfig(), readProviderCredentials()]).then(
    ([config, credentials]) => {
      const storedConfig = config.providers[providerId];
      const storedCredential = credentials.providers[providerId];

      if (storedConfig?.kind !== "api-key" || storedCredential?.kind !== "api-key") {
        throw new Error(`Provider ${providerId} is not configured`);
      }

      return {
        config: storedConfig,
        apiKey: storedCredential.apiKey,
        isDefault: config.defaultProvider === providerId
      };
    }
  );
}

function extractOpenAiText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    payload &&
    typeof payload === "object" &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    const chunks = payload.output
      .flatMap((entry) =>
        entry &&
        typeof entry === "object" &&
        "content" in entry &&
        Array.isArray(entry.content)
          ? entry.content
          : []
      )
      .map((entry) =>
        entry &&
        typeof entry === "object" &&
        "text" in entry &&
        typeof entry.text === "string"
          ? entry.text
          : ""
      )
      .filter(Boolean);

    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  throw new Error("Unable to parse OpenAI response text");
}

function extractAnthropicText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "content" in payload &&
    Array.isArray(payload.content)
  ) {
    const chunks = payload.content
      .map((entry) =>
        entry &&
        typeof entry === "object" &&
        "text" in entry &&
        typeof entry.text === "string"
          ? entry.text
          : ""
      )
      .filter(Boolean);

    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  throw new Error("Unable to parse Anthropic response text");
}

async function postJson(fetchFn: FetchFn, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetchFn(url, init);

  if (!response.ok) {
    throw new Error(`Provider request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function resolveApiKeyLogin(options: {
  providerId: "openai-api" | "anthropic-api";
  defaultEnvName: string;
  loginOptions: Record<string, unknown>;
}): Promise<{
  apiKey: string;
  model: string;
  apiBaseUrl: string | null;
}> {
  const directApiKey =
    typeof options.loginOptions.apiKey === "string" ? options.loginOptions.apiKey.trim() : "";
  const apiKeyEnv =
    typeof options.loginOptions.apiKeyEnv === "string"
      ? options.loginOptions.apiKeyEnv
      : options.defaultEnvName;
  const envApiKey = apiKeyEnv ? process.env[apiKeyEnv]?.trim() ?? "" : "";
  const streams =
    options.loginOptions.streams && typeof options.loginOptions.streams === "object"
      ? (options.loginOptions.streams as ProviderTurnOptions["streams"])
      : undefined;
  const output = streams?.output ?? process.stdout;
  const canPromptForSetupMode = Boolean(
    (streams?.input as { isTTY?: boolean; setRawMode?: (enabled: boolean) => void } | undefined)
      ?.isTTY &&
      typeof (streams?.input as { setRawMode?: (enabled: boolean) => void } | undefined)
        ?.setRawMode === "function"
  );
  const providerLabel = options.providerId === "openai-api" ? "OpenAI API" : "Anthropic API";
  const accent = getProviderAccent(providerLabel);
  const storedConfig = (await readProviderConfig()).providers[options.providerId];
  const defaults = resolveProviderDefaults(options.providerId);
  const defaultModel =
    typeof options.loginOptions.model === "string" && options.loginOptions.model
      ? options.loginOptions.model
      : storedConfig?.kind === "api-key"
        ? storedConfig.model
        : defaults.model;
  const defaultApiBaseUrl =
    typeof options.loginOptions.apiBaseUrl === "string" && options.loginOptions.apiBaseUrl
      ? options.loginOptions.apiBaseUrl
      : storedConfig?.kind === "api-key"
        ? storedConfig.apiBaseUrl
        : defaults.apiBaseUrl;

  async function askField(config: {
    field: string;
    step: number;
    total: number;
    hint?: string;
    prompt: string;
    defaultValue?: string | null;
  }): Promise<string> {
    output.write(
      `${renderFieldPrompt({
        title: `${providerLabel} Login`,
        field: config.field,
        step: config.step,
        total: config.total,
        hint: config.hint
      })}\n`
    );
    const suffix = config.defaultValue ? ` (Enter keeps ${config.defaultValue})` : "";
    const answer = await promptForText(
      renderPromptLabel(`${config.prompt}${suffix} `),
      streams ?? {}
    );
    return answer.trim() || config.defaultValue || "";
  }

  output.write(
    `${renderPanel({
      title: `${providerLabel} Login`,
      subtitle: "Provider setup",
      lines: [
        {
          text:
            directApiKey || envApiKey
              ? "A usable API key source is already available."
              : "Add an API key and choose how much of the provider config to customize."
        },
        {
          text: `Preferred env var: ${apiKeyEnv}`,
          tone: "subtle"
        },
        {
          text: `Default model: ${defaultModel}`,
          tone: "subtle"
        },
        ...(defaultApiBaseUrl
          ? [{ text: `Default API base: ${defaultApiBaseUrl}`, tone: "subtle" as const }]
          : [])
      ],
      accent
    })}\n`
  );

  const setupMode =
    typeof options.loginOptions.setupMode === "string" &&
    (options.loginOptions.setupMode === "quick" || options.loginOptions.setupMode === "advanced")
      ? options.loginOptions.setupMode
      : canPromptForSetupMode
        ? await promptForMenuSelection<"quick" | "advanced">({
            title: `${providerLabel} setup`,
            streams,
            fallbackPrompt: "Choose setup mode: ",
            options: [
              {
                label: "[1] Quick setup (recommended defaults)",
                value: "quick",
                keywords: ["1", "quick", "recommended"]
              },
              {
                label: "[2] Advanced setup (custom model / base URL)",
                value: "advanced",
                keywords: ["2", "advanced", "custom"]
              }
            ]
          })
        : "quick";

  const apiKey =
    directApiKey ||
    envApiKey ||
    (await askField({
      field: "API key",
      step: 1,
      total: setupMode === "advanced" ? 3 : 1,
      hint: `Preferred env var: ${apiKeyEnv}`,
      prompt: `${providerLabel} api key:`
    }));

  if (!apiKey) {
    throw new Error(`Missing API key for ${options.providerId}`);
  }

  const model =
    setupMode === "advanced"
      ? await askField({
          field: "Model",
          step: 2,
          total: 3,
          hint: "Press Enter to keep the recommended or previous model",
          prompt: `${providerLabel} model:`,
          defaultValue: defaultModel
        })
      : defaultModel;
  const apiBaseUrl =
    setupMode === "advanced"
      ? await askField({
          field: "API base URL",
          step: 3,
          total: 3,
          hint: "Press Enter to keep the recommended or previous API base URL",
          prompt: `${providerLabel} API base URL:`,
          defaultValue: defaultApiBaseUrl
        })
      : defaultApiBaseUrl;

  output.write(
    `${renderPanel({
      title: `${providerLabel} Summary`,
      subtitle: setupMode === "advanced" ? "Advanced provider configuration" : "Recommended defaults",
      lines: [
        {
          text: directApiKey || envApiKey ? "apiKey: provided by direct input or environment" : "apiKey: entered interactively"
        },
        { text: `model: ${model}` },
        { text: `apiBaseUrl: ${apiBaseUrl ?? "default provider base"}`, tone: "subtle" }
      ],
      accent
    })}\n`
  );

  return {
    apiKey,
    model,
    apiBaseUrl
  };
}

export function createOpenAiAdapter(dependencies: { fetchFn?: FetchFn } = {}): ProviderAdapter {
  const fetchFn = dependencies.fetchFn ?? fetch;

  async function buildStatus(): Promise<ProviderStatus> {
    const config = await readProviderConfig();
    const credentials = await readProviderCredentials();
    const storedConfig = config.providers["openai-api"];
    const storedCredential = credentials.providers["openai-api"];

    return {
      id: "openai-api",
      kind: "api-key",
      installed: true,
      configured: storedConfig?.kind === "api-key",
      authenticated: storedCredential?.kind === "api-key",
      isDefault: config.defaultProvider === "openai-api",
      detail:
        storedConfig?.kind === "api-key" && storedCredential?.kind === "api-key"
          ? "ready"
          : "requires API key login",
      model: storedConfig?.kind === "api-key" ? storedConfig.model : null
    };
  }

  return {
    id: "openai-api",
    kind: "api-key",
    detect: buildStatus,
    status: buildStatus,
    async login(loginOptions) {
      const resolved = await resolveApiKeyLogin({
        providerId: "openai-api",
        defaultEnvName: "OPENAI_API_KEY",
        loginOptions
      });

      await upsertProviderConfig({
        id: "openai-api",
        kind: "api-key",
        model: resolved.model,
        apiBaseUrl: resolved.apiBaseUrl
      });
      await upsertProviderCredential("openai-api", {
        kind: "api-key",
        apiKey: resolved.apiKey
      });

      return buildStatus();
    },
    async logout() {
      await removeProviderCredential("openai-api");
      await removeProviderConfig("openai-api");
    },
    async sendTurn(sessionContext, input, turnOptions): Promise<ProviderTurnResult> {
      const { config, apiKey } = await requireApiKeyConfig("openai-api");
      const systemPrompt = resolveSystemPrompt(input.history, sessionContext.startupPrompt);
      const request = {
        model: config.model,
        input: [
          {
            role: "system",
            content: [{ type: "input_text", text: systemPrompt }]
          },
          ...buildConversationMessages(input.history, input.userMessage).map((message) => ({
            role: message.role,
            content: [{ type: "input_text", text: message.content }]
          }))
        ]
      };

      if (turnOptions.dryRun) {
        return {
          provider: "openai-api",
          kind: "api-key",
          request,
          responseText: ""
        };
      }

      await emitStatus(turnOptions, "Sending turn to OpenAI");
      const payload = await postJson(fetchFn, `${config.apiBaseUrl}/responses`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      });
      const responseText = extractOpenAiText(payload);
      await emitDone(turnOptions);

      return {
        provider: "openai-api",
        kind: "api-key",
        request,
        responseText
      };
    }
  };
}

export function createAnthropicAdapter(
  dependencies: { fetchFn?: FetchFn } = {}
): ProviderAdapter {
  const fetchFn = dependencies.fetchFn ?? fetch;

  async function buildStatus(): Promise<ProviderStatus> {
    const config = await readProviderConfig();
    const credentials = await readProviderCredentials();
    const storedConfig = config.providers["anthropic-api"];
    const storedCredential = credentials.providers["anthropic-api"];

    return {
      id: "anthropic-api",
      kind: "api-key",
      installed: true,
      configured: storedConfig?.kind === "api-key",
      authenticated: storedCredential?.kind === "api-key",
      isDefault: config.defaultProvider === "anthropic-api",
      detail:
        storedConfig?.kind === "api-key" && storedCredential?.kind === "api-key"
          ? "ready"
          : "requires API key login",
      model: storedConfig?.kind === "api-key" ? storedConfig.model : null
    };
  }

  return {
    id: "anthropic-api",
    kind: "api-key",
    detect: buildStatus,
    status: buildStatus,
    async login(loginOptions) {
      const resolved = await resolveApiKeyLogin({
        providerId: "anthropic-api",
        defaultEnvName: "ANTHROPIC_API_KEY",
        loginOptions
      });

      await upsertProviderConfig({
        id: "anthropic-api",
        kind: "api-key",
        model: resolved.model,
        apiBaseUrl: resolved.apiBaseUrl
      });
      await upsertProviderCredential("anthropic-api", {
        kind: "api-key",
        apiKey: resolved.apiKey
      });

      return buildStatus();
    },
    async logout() {
      await removeProviderCredential("anthropic-api");
      await removeProviderConfig("anthropic-api");
    },
    async sendTurn(sessionContext, input, turnOptions): Promise<ProviderTurnResult> {
      const { config, apiKey } = await requireApiKeyConfig("anthropic-api");
      const request = {
        model: config.model,
        max_tokens: 1024,
        system: resolveSystemPrompt(input.history, sessionContext.startupPrompt),
        messages: buildConversationMessages(input.history, input.userMessage)
      };

      if (turnOptions.dryRun) {
        return {
          provider: "anthropic-api",
          kind: "api-key",
          request,
          responseText: ""
        };
      }

      await emitStatus(turnOptions, "Sending turn to Anthropic");
      const payload = await postJson(fetchFn, `${config.apiBaseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      });
      const responseText = extractAnthropicText(payload);
      await emitDone(turnOptions);

      return {
        provider: "anthropic-api",
        kind: "api-key",
        request,
        responseText
      };
    }
  };
}

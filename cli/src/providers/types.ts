export const providerIds = [
  "codex-local",
  "claude-local",
  "openai-api",
  "anthropic-api",
  "hosted-oauth"
] as const;

export type ProviderId = (typeof providerIds)[number];
export type ProviderKind = "local" | "api-key" | "oauth";
export type ProviderTurnEvent =
  | { type: "status"; message: string }
  | { type: "text-delta"; text: string }
  | { type: "tool-activity"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };

export type ProviderStatus = {
  id: ProviderId;
  kind: ProviderKind;
  installed: boolean;
  configured: boolean;
  authenticated: boolean;
  isDefault: boolean;
  detail: string;
  executablePath?: string | null;
  model?: string | null;
};

export type ProviderTurnResult = {
  provider: ProviderId;
  kind: ProviderKind;
  request?: unknown;
  responseText: string;
};

export type ProviderTurnOptions = {
  dryRun?: boolean;
  streams?: {
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
  };
  onEvent?: (event: ProviderTurnEvent) => void | Promise<void>;
};

export type ProviderAdapter = {
  id: ProviderId;
  kind: ProviderKind;
  detect(): Promise<ProviderStatus>;
  status(): Promise<ProviderStatus>;
  login(options: Record<string, unknown>): Promise<ProviderStatus>;
  logout(): Promise<void>;
  sendTurn(
    sessionContext: import("../lib/repository-context.js").SessionContext,
    input: {
      history: import("../lib/session.js").SessionMessage[];
      userMessage: string;
    },
    options: ProviderTurnOptions
  ): Promise<ProviderTurnResult>;
};

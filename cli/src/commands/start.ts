import {
  buildSessionContext,
  RepositoryResolutionError,
  type SessionContext
} from "../lib/repository-context.js";
import { createSessionHistory, type SessionMessage } from "../lib/session.js";
import { readProviderConfig } from "../lib/provider-store.js";
import { getProviderAdapter } from "../providers/index.js";
import type { ProviderId, ProviderTurnResult } from "../providers/types.js";

export class StartCommandError extends Error {
  nextStep: string;

  constructor(message: string, nextStep: string) {
    super(message);
    this.name = "StartCommandError";
    this.nextStep = nextStep;
  }
}

export type StartResult = {
  provider: ProviderId;
  sessionContext: SessionContext;
  history: SessionMessage[];
  result: ProviderTurnResult;
};

export async function resolveProviderId(requestedProvider?: ProviderId): Promise<ProviderId> {
  if (requestedProvider) {
    return requestedProvider;
  }

  const config = await readProviderConfig();

  if (!config.defaultProvider) {
    throw new StartCommandError(
      "No provider selected. Use --provider or configure a default provider first.",
      "fortheagent-cli"
    );
  }

  return config.defaultProvider;
}

export async function runStart(options: {
  cwd: string;
  provider?: ProviderId;
  prompt?: string;
  dryRun?: boolean;
  streams?: {
    input?: NodeJS.ReadableStream;
    output?: NodeJS.WritableStream;
  };
}): Promise<StartResult> {
  const providerId = await resolveProviderId(options.provider);

  let sessionContext: SessionContext;

  try {
    sessionContext = await buildSessionContext(options.cwd, options.prompt);
  } catch (error) {
    if (error instanceof RepositoryResolutionError) {
      throw new StartCommandError(error.message, error.nextStep);
    }

    throw error;
  }

  const provider = getProviderAdapter(providerId);
  const history = createSessionHistory(sessionContext);
  const result = await provider.sendTurn(
    sessionContext,
    {
      history,
      userMessage: options.prompt ?? ""
    },
    {
      dryRun: options.dryRun,
      streams: options.streams
    }
  );

  return {
    provider: providerId,
    sessionContext,
    history,
    result
  };
}

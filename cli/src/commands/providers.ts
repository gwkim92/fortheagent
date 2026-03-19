import { listProviderAdapters } from "../providers/index.js";
import type { ProviderStatus } from "../providers/types.js";

export type ProvidersResult = {
  providers: ProviderStatus[];
};

export async function runProviders(): Promise<ProvidersResult> {
  const providers = await Promise.all(
    listProviderAdapters().map(async (provider) => provider.status())
  );

  return {
    providers
  };
}

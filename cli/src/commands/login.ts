import { getProviderAdapter } from "../providers/index.js";
import type { ProviderId, ProviderStatus } from "../providers/types.js";
import { setDefaultProvider } from "../lib/provider-store.js";

export async function runLogin(options: {
  provider: ProviderId;
  setDefault?: boolean;
  loginOptions?: Record<string, unknown>;
}): Promise<ProviderStatus> {
  const provider = getProviderAdapter(options.provider);
  const status = await provider.login(options.loginOptions ?? {});

  if (options.setDefault) {
    await setDefaultProvider(options.provider);
    return provider.status();
  }

  return status;
}

import { getProviderAdapter } from "../providers/index.js";
import type { ProviderId } from "../providers/types.js";

export async function runLogout(options: { provider: ProviderId }): Promise<void> {
  const provider = getProviderAdapter(options.provider);
  await provider.logout();
}

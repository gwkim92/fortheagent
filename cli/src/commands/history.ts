import { readManifestState } from "../lib/current-selection.js";
import { runFoundationHistory } from "../lib/foundation-engine.js";
import { runSync } from "./sync.js";

export async function runHistory(options: {
  cwd: string;
}): Promise<Awaited<ReturnType<typeof runFoundationHistory>>> {
  const manifestState = await readManifestState(options.cwd);

  if (!manifestState.manifest) {
    return {
      ok: false,
      status: "missing",
      reason: "forTheAgent manifest not found"
    };
  }

  if (manifestState.legacy) {
    await runSync({ cwd: options.cwd });
  }

  return runFoundationHistory(options);
}

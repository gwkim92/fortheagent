import { readManifestState } from "../lib/current-selection.js";
import { runFoundationWork } from "../lib/foundation-engine.js";
import { runSync } from "./sync.js";

export async function runWork(options: {
  cwd: string;
  mode?: "design" | "implementation" | "maintenance";
  activeWorkItem?: string;
  archiveActive?: boolean;
}): Promise<Awaited<ReturnType<typeof runFoundationWork>>> {
  const manifestState = await readManifestState(options.cwd);

  if (!manifestState.manifest) {
    throw new Error("forTheAgent manifest not found");
  }

  if (manifestState.legacy) {
    await runSync({ cwd: options.cwd });
  }

  return runFoundationWork(options);
}

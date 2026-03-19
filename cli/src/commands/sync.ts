import { readManifestState } from "../lib/current-selection.js";
import { runFoundationInit, runFoundationSync } from "../lib/foundation-engine.js";

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

export async function runSync(options: {
  cwd: string;
  dryRun?: boolean;
  repair?: boolean;
  prune?: boolean;
}): Promise<{
  updated: string[];
  skipped: string[];
  conflicted: string[];
  pruned: string[];
  migratedLegacy: boolean;
}> {
  const manifestState = await readManifestState(options.cwd);

  if (manifestState.legacy && manifestState.manifest) {
    const initResult = await runFoundationInit({
      cwd: options.cwd,
      mode: manifestState.manifest.status === "resolved" ? "interactive" : "deferred",
      projectPhase: manifestState.manifest.projectPhase,
      frontend: manifestState.manifest.frontend ?? undefined,
      backend: manifestState.manifest.backend ?? undefined,
      systemType: manifestState.manifest.systemType ?? undefined,
      architectureStyle: manifestState.manifest.architectureStyle ?? undefined,
      constraints: manifestState.manifest.constraints,
      qualityProfiles: manifestState.manifest.qualityProfiles,
      practiceProfiles: manifestState.manifest.practiceProfiles,
      projectContext: manifestState.manifest.projectContext
    });
    const syncResult = await runFoundationSync(options);

    return {
      updated: unique([...initResult.updated, ...syncResult.updated]),
      skipped: syncResult.skipped,
      conflicted: syncResult.conflicted,
      pruned: syncResult.pruned,
      migratedLegacy: true
    };
  }

  const syncResult = await runFoundationSync(options);

  return {
    ...syncResult,
    migratedLegacy: false
  };
}

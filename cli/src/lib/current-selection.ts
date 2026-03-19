import { readFile } from "node:fs/promises";
import { parseManifestCompat, type Manifest } from "./manifest.js";
import { resolveManifestPath } from "./paths.js";
import type { SelectionInput } from "./selection.js";

export type ManifestState = {
  manifest: Manifest | null;
  legacy: boolean;
};

export async function readManifestState(cwd: string): Promise<ManifestState> {
  try {
    const manifestContents = await readFile(resolveManifestPath(cwd), "utf8");
    const parsed = parseManifestCompat(JSON.parse(manifestContents));

    return {
      manifest: parsed.manifest,
      legacy: parsed.legacy
    };
  } catch {
    return {
      manifest: null,
      legacy: false
    };
  }
}

export async function readManifest(cwd: string): Promise<Manifest | null> {
  const state = await readManifestState(cwd);
  return state.manifest;
}

export function manifestToSelectionDefaults(
  manifest: Manifest | null
): Partial<SelectionInput> | undefined {
  if (!manifest) {
    return undefined;
  }

  return {
    projectPhase: manifest.projectPhase,
    frontend: manifest.frontend ?? undefined,
    backend: manifest.backend ?? undefined,
    systemType: manifest.systemType ?? undefined,
    architectureStyle: manifest.architectureStyle ?? undefined,
    constraints: manifest.constraints,
    qualityProfiles: manifest.qualityProfiles,
    practiceProfiles: manifest.practiceProfiles,
    primaryProduct: manifest.projectContext.primaryProduct,
    targetUsers: manifest.projectContext.targetUsers,
    coreEntities: manifest.projectContext.coreEntities,
    criticalRisks: manifest.projectContext.criticalRisks,
    deliveryPriorities: manifest.projectContext.deliveryPriorities,
    currentPainPoints: manifest.projectContext.currentPainPoints,
    stabilityConstraints: manifest.projectContext.stabilityConstraints
  };
}

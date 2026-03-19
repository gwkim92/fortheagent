import { readFile } from "node:fs/promises";
import { parseManifest, type Manifest } from "./manifest.js";
import { detectRepositoryRoot, resolveManifestPath } from "./paths.js";
import type { SelectionInput } from "./selection.js";

export async function readManifest(cwd: string): Promise<Manifest | null> {
  try {
    const root = await detectRepositoryRoot(cwd);
    const manifestContents = await readFile(resolveManifestPath(root), "utf8");
    return parseManifest(JSON.parse(manifestContents));
  } catch {
    return null;
  }
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

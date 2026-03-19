import { runFoundationInit } from "../lib/foundation-engine.js";
import type { SelectionInput } from "../lib/selection.js";

export async function runInit(options: {
  cwd: string;
  mode: "interactive" | "deferred";
  selection?: SelectionInput;
}): Promise<{ manifest: Awaited<ReturnType<typeof runFoundationInit>>["manifest"]; updated: string[] }> {
  if (options.mode === "deferred" || !options.selection) {
    return runFoundationInit({
      cwd: options.cwd,
      mode: "deferred"
    });
  }

  return runFoundationInit({
    cwd: options.cwd,
    mode: "interactive",
    projectPhase: options.selection.projectPhase,
    frontend: options.selection.frontend ?? undefined,
    backend: options.selection.backend ?? undefined,
    systemType: options.selection.systemType ?? undefined,
    architectureStyle: options.selection.architectureStyle ?? undefined,
    constraints: options.selection.constraints,
    qualityProfiles: options.selection.qualityProfiles,
    practiceProfiles: options.selection.practiceProfiles,
    projectContext: {
      primaryProduct: options.selection.primaryProduct,
      targetUsers: options.selection.targetUsers,
      coreEntities: options.selection.coreEntities,
      criticalRisks: options.selection.criticalRisks,
      deliveryPriorities: options.selection.deliveryPriorities,
      currentPainPoints: options.selection.currentPainPoints,
      stabilityConstraints: options.selection.stabilityConstraints
    }
  });
}

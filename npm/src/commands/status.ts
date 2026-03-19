import { readManifest } from "../lib/current-selection.js";
import { applyDefaultWorkflowState } from "../lib/workflow-state.js";

export type StatusResult =
  | {
      ok: true;
      status: "resolved" | "unresolved";
      readiness: "ready" | "needs-discovery";
      frontend: string | null;
      backend: string | null;
      systemType: string | null;
      architectureStyle: string | null;
      constraints: string[];
      workflowMode: "design" | "implementation" | "maintenance";
      activeWorkItem: string | null;
      lastResolvedAt: string | null;
    }
  | {
      ok: false;
      status: "missing";
      reason: string;
    };

export async function runStatus(options: { cwd: string }): Promise<StatusResult> {
  const manifest = await readManifest(options.cwd);

  if (!manifest) {
    return {
      ok: false,
      status: "missing",
      reason: "fortheagent manifest not found"
    };
  }

  const current = applyDefaultWorkflowState(manifest);

  return {
    ok: true,
    status: current.status,
    readiness: current.status === "resolved" ? "ready" : "needs-discovery",
    frontend: current.frontend,
    backend: current.backend,
    systemType: current.systemType,
    architectureStyle: current.architectureStyle,
    constraints: current.constraints,
    workflowMode: current.workflowState.mode,
    activeWorkItem: current.workflowState.activeWorkItem,
    lastResolvedAt: current.lastResolvedAt
  };
}

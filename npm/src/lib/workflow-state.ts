import path from "node:path";
import type { Manifest } from "./manifest.js";

export function buildInitialActiveWorkItemPath(
  projectPhase: Manifest["projectPhase"]
): string {
  return projectPhase === "existing"
    ? "docs/work/active/0001-repository-baseline-and-target.md"
    : "docs/work/active/0001-initial-design-scope.md";
}

export function buildInitialDecisionDocPath(
  projectPhase: Manifest["projectPhase"]
): string | null {
  return projectPhase === "existing" ? "docs/decisions/ADR-0001-repository-baseline.md" : null;
}

export function normalizeActiveWorkItemPath(
  activeWorkItem: string | null,
  projectPhase: Manifest["projectPhase"]
): string | null {
  if (!activeWorkItem) {
    return null;
  }

  if (activeWorkItem.startsWith("docs/work/active/")) {
    return activeWorkItem;
  }

  if (activeWorkItem.endsWith(".md")) {
    return path.posix.join("docs", "work", "active", activeWorkItem);
  }

  return path.posix.join("docs", "work", "active", `${activeWorkItem}.md`);
}

export function resolveActiveWorkItemPath(
  manifest: Pick<Manifest, "status" | "projectPhase" | "workflowState">
): string | null {
  const normalized = normalizeActiveWorkItemPath(
    manifest.workflowState.activeWorkItem,
    manifest.projectPhase
  );

  if (normalized) {
    return normalized;
  }

  if (manifest.status !== "resolved") {
    return null;
  }

  return buildInitialActiveWorkItemPath(manifest.projectPhase);
}

export function applyDefaultWorkflowState(manifest: Manifest): Manifest {
  const activeWorkItem = resolveActiveWorkItemPath(manifest);

  if (activeWorkItem === manifest.workflowState.activeWorkItem) {
    return manifest;
  }

  return {
    ...manifest,
    workflowState: {
      ...manifest.workflowState,
      activeWorkItem
    }
  };
}

export function updateWorkflowState(
  manifest: Manifest,
  options: {
    mode?: Manifest["workflowState"]["mode"];
    activeWorkItem?: string;
  }
): Manifest {
  return {
    ...manifest,
    workflowState: {
      mode: options.mode ?? manifest.workflowState.mode,
      activeWorkItem:
        options.activeWorkItem === undefined
          ? manifest.workflowState.activeWorkItem
          : normalizeActiveWorkItemPath(options.activeWorkItem, manifest.projectPhase)
    }
  };
}

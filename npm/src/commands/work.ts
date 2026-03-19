import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { applyDocFrontmatter, describeDocument } from "../lib/doc-contract.js";
import { parseManifest, validateManifest, type Manifest } from "../lib/manifest.js";
import {
  detectRepositoryRoot,
  resolveManifestPath,
  resolveProfileRegistryPath
} from "../lib/paths.js";
import {
  collectExpectedTemplateRoots,
  loadProfileRegistry,
  validateProfileRegistry,
  validateProfileRegistryTemplates
} from "../lib/profile-registry.js";
import { scanRepository } from "../lib/repo-scan.js";
import { renderFoundation } from "../lib/render.js";
import { applyDefaultWorkflowState, updateWorkflowState } from "../lib/workflow-state.js";

async function readIfExists(targetPath: string): Promise<string | null> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function insertSectionBeforeHeading(
  content: string,
  heading: string,
  section: string
): string {
  const normalized = content.replace(/\s+$/, "");
  const marker = `\n${heading}\n`;
  const index = normalized.indexOf(marker);

  if (index === -1) {
    return `${normalized}\n\n${section}\n`;
  }

  return `${normalized.slice(0, index)}\n\n${section}${normalized.slice(index)}\n`;
}

function buildArchiveWorkSummary(params: {
  previousWorkItemPath: string;
  nextWorkItemPath: string | null;
  workflowMode: Manifest["workflowState"]["mode"];
  archivedHandoffPath: string | null;
}): string {
  return [
    "## Completion Summary",
    `- Archived automatically while workflow mode was \`${params.workflowMode}\`.`,
    `- Previous active work item: \`${params.previousWorkItemPath}\`.`,
    params.nextWorkItemPath
      ? `- Next active work item: \`${params.nextWorkItemPath}\`.`
      : "- No next active work item was recorded at archive time.",
    params.archivedHandoffPath
      ? `- Matching handoff snapshot: \`${params.archivedHandoffPath}\`.`
      : "- No matching archived handoff snapshot was recorded.",
    "- Add project-specific outcome notes below if this work item finished meaningful repository changes before it was archived."
  ].join("\n");
}

function buildArchiveHandoffSummary(params: {
  previousWorkItemPath: string;
  nextWorkItemPath: string | null;
  workflowMode: Manifest["workflowState"]["mode"];
  archivedWorkPath: string | null;
}): string {
  return [
    "## Completion Summary",
    `- Snapshot archived while workflow mode was \`${params.workflowMode}\`.`,
    `- Archived handoff belonged to \`${params.previousWorkItemPath}\`.`,
    params.nextWorkItemPath
      ? `- Follow-up moved to \`${params.nextWorkItemPath}\`.`
      : "- No follow-up active work item was recorded when this snapshot was archived.",
    params.archivedWorkPath
      ? `- Matching archived work item: \`${params.archivedWorkPath}\`.`
      : "- No archived work item record was written.",
    "- Continue from `.agent-foundation/handoffs/current.md` and the current active work item instead of reopening this snapshot by default."
  ].join("\n");
}

export async function runWork(options: {
  cwd: string;
  mode?: Manifest["workflowState"]["mode"];
  activeWorkItem?: string;
  archiveActive?: boolean;
}): Promise<{
  manifest: Manifest;
  updated: string[];
  archived: string | null;
}> {
  const cwd = await detectRepositoryRoot(options.cwd);
  const registryContents = await readFile(resolveProfileRegistryPath(cwd), "utf8");
  const { registry } = loadProfileRegistry(JSON.parse(registryContents));
  const registryErrors = [...validateProfileRegistry(registry)];

  const manifestContents = await readFile(resolveManifestPath(cwd), "utf8");
  const currentManifest = applyDefaultWorkflowState(parseManifest(JSON.parse(manifestContents)));
  const currentActiveWorkItem = currentManifest.workflowState.activeWorkItem;

  if (options.archiveActive && !currentActiveWorkItem) {
    throw new Error("Archiving active work requires a current active work item");
  }

  if (options.archiveActive && !options.activeWorkItem) {
    throw new Error("Archiving active work requires --active-work-item for the next task");
  }

  const requestedManifest = updateWorkflowState(currentManifest, {
    mode: options.mode,
    activeWorkItem: options.activeWorkItem
  });
  const archivedWorkPath =
    options.archiveActive && currentActiveWorkItem
      ? currentActiveWorkItem.replace("docs/work/active/", "docs/work/archive/")
      : null;
  const archivedHandoffPath =
    options.archiveActive && currentActiveWorkItem
      ? path.posix.join(
          ".agent-foundation",
          "handoffs",
          "archive",
          path.posix.basename(currentActiveWorkItem)
        )
      : null;
  const currentActiveContent =
    options.archiveActive && currentActiveWorkItem
      ? await readIfExists(path.join(cwd, currentActiveWorkItem))
      : null;
  const currentHandoffContent =
    options.archiveActive
      ? await readIfExists(path.join(cwd, ".agent-foundation", "handoffs", "current.md"))
      : null;

  if (options.archiveActive && currentActiveWorkItem && !currentActiveContent) {
    throw new Error(`Active work item not found: ${currentActiveWorkItem}`);
  }

  if (options.archiveActive && !currentHandoffContent) {
    throw new Error("Current handoff not found");
  }

  if (archivedWorkPath && (await readIfExists(path.join(cwd, archivedWorkPath)))) {
    throw new Error(`Archive work item already exists: ${archivedWorkPath}`);
  }

  if (archivedHandoffPath && (await readIfExists(path.join(cwd, archivedHandoffPath)))) {
    throw new Error(`Archive handoff already exists: ${archivedHandoffPath}`);
  }

  if (
    options.archiveActive &&
    requestedManifest.workflowState.activeWorkItem === currentActiveWorkItem
  ) {
    throw new Error("Archiving active work requires a different next active work item");
  }

  const hasChanges =
    requestedManifest.workflowState.mode !== currentManifest.workflowState.mode ||
    requestedManifest.workflowState.activeWorkItem !==
      currentManifest.workflowState.activeWorkItem;

  if (!hasChanges) {
    return {
      manifest: currentManifest,
      updated: [],
      archived: null
    };
  }

  const nextManifest: Manifest = {
    ...requestedManifest,
    generatedAt: new Date().toISOString()
  };
  const manifestErrors = validateManifest(nextManifest, registry);
  const templateErrors = await validateProfileRegistryTemplates(
    collectExpectedTemplateRoots(nextManifest, registry)
  );
  const allErrors = [...registryErrors, ...manifestErrors, ...templateErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join("\n"));
  }

  const scan =
    (archivedWorkPath && currentActiveContent) || (archivedHandoffPath && currentHandoffContent)
      ? await scanRepository(cwd)
      : null;
  const contentOverrides =
    scan &&
    ((archivedWorkPath && currentActiveContent) || (archivedHandoffPath && currentHandoffContent))
      ? new Map([
          ...(
            archivedWorkPath && currentActiveContent
              ? [
                  [
                    archivedWorkPath,
                    (() => {
                      const descriptor = describeDocument(
                        archivedWorkPath,
                        nextManifest,
                        scan
                      );

                      const withSummary = insertSectionBeforeHeading(
                        currentActiveContent,
                        "## Working notes",
                        buildArchiveWorkSummary({
                          previousWorkItemPath: currentActiveWorkItem!,
                          nextWorkItemPath: nextManifest.workflowState.activeWorkItem,
                          workflowMode: currentManifest.workflowState.mode,
                          archivedHandoffPath
                        })
                      );

                      return descriptor?.frontmatter
                        ? applyDocFrontmatter(withSummary, descriptor.frontmatter)
                        : withSummary;
                    })()
                  ] as const
                ]
              : []
          ),
          ...(
            archivedHandoffPath && currentHandoffContent
              ? [
                  [
                    archivedHandoffPath,
                    (() => {
                      const descriptor = describeDocument(
                        archivedHandoffPath,
                        nextManifest,
                        scan
                      );

                      const withSummary = insertSectionBeforeHeading(
                        currentHandoffContent,
                        "## Freshness",
                        buildArchiveHandoffSummary({
                          previousWorkItemPath: currentActiveWorkItem!,
                          nextWorkItemPath: nextManifest.workflowState.activeWorkItem,
                          workflowMode: currentManifest.workflowState.mode,
                          archivedWorkPath
                        })
                      );

                      return descriptor?.frontmatter
                        ? applyDocFrontmatter(withSummary, descriptor.frontmatter)
                        : withSummary;
                    })()
                  ] as const
                ]
              : []
          )
        ])
      : undefined;

  const summary = await renderFoundation({
    cwd,
    manifest: nextManifest,
    registry,
    extraGeneratedFiles:
      archivedWorkPath || archivedHandoffPath
        ? [archivedWorkPath, archivedHandoffPath].filter((value): value is string => Boolean(value))
        : undefined,
    contentOverrides
  });
  const archived =
    archivedWorkPath && currentActiveWorkItem && currentActiveContent
      ? archivedWorkPath
      : null;

  if (archived && currentActiveWorkItem) {
    await rm(path.join(cwd, currentActiveWorkItem), { force: true });
  }

  return {
    manifest: nextManifest,
    updated: summary.updated,
    archived
  };
}

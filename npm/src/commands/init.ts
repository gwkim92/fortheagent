import { readFile } from "node:fs/promises";
import path from "node:path";
import { classifyFile } from "../lib/file-ownership.js";
import {
  buildInstalledProfiles,
  createUnresolvedManifest,
  type Manifest,
  validateManifest
} from "../lib/manifest.js";
import { mergeManagedContent } from "../lib/markers.js";
import { detectRepositoryRoot, resolveManifestPath } from "../lib/paths.js";
import {
  collectExpectedTemplateRoots,
  profileRegistry,
  validateProfileRegistryTemplates
} from "../lib/profile-registry.js";
import { buildDesiredFileContents, renderFoundation } from "../lib/render.js";
import { applyDefaultWorkflowState } from "../lib/workflow-state.js";

export class InitCollisionError extends Error {
  readonly collisions: string[];

  constructor(collisions: string[]) {
    super(`Existing files would be overwritten: ${collisions.join(", ")}`);
    this.name = "InitCollisionError";
    this.collisions = collisions;
  }
}

async function readIfExists(targetPath: string): Promise<string | null> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

async function detectInitCollisions(options: {
  cwd: string;
  manifest: Manifest;
}): Promise<string[]> {
  const existingManifest = await readIfExists(resolveManifestPath(options.cwd));

  if (existingManifest !== null) {
    return [];
  }

  const collisions: string[] = [];
  const targets = await buildDesiredFileContents({
    cwd: options.cwd,
    manifest: options.manifest
  });

  for (const [repositoryPath, content] of targets.entries()) {
    const existing = await readIfExists(path.join(options.cwd, repositoryPath));

    if (existing === null || existing === content) {
      continue;
    }

    const ownership = classifyFile(repositoryPath);

    if (ownership === "merge-managed" && mergeManagedContent(content, existing) !== null) {
      continue;
    }

    collisions.push(repositoryPath);
  }

  return collisions.sort();
}

function createResolvedManifest(options: {
  projectPhase?: "greenfield" | "existing";
  frontend: string;
  backend: string;
  systemType?: string | null;
  architectureStyle?: string | null;
  constraints?: string[];
  qualityProfiles?: string[];
  practiceProfiles?: string[];
  projectContext?: {
    primaryProduct?: string;
    targetUsers?: string[];
    coreEntities?: string[];
    criticalRisks?: string[];
    deliveryPriorities?: string[];
    currentPainPoints?: string[];
    stabilityConstraints?: string[];
  };
}): Manifest {
  const generatedAt = new Date().toISOString();
  const projectPhase = options.projectPhase ?? "greenfield";
  const systemType = options.systemType ?? "internal-tool";
  const architectureStyle = options.architectureStyle ?? "monolith";
  const constraints = [...new Set(options.constraints ?? [])].sort();
  const qualityProfiles = [...new Set(options.qualityProfiles ?? [])].sort();
  const practiceProfiles = [...new Set(options.practiceProfiles ?? [])].sort();

  return {
    version: "0.1.0",
    foundationVersion: "0.1.0",
    generatedAt,
    status: "resolved",
    projectPhase,
    frontend: options.frontend,
    backend: options.backend,
    systemType,
    architectureStyle,
    constraints,
    qualityProfiles,
    practiceProfiles,
    projectContext: {
      primaryProduct: options.projectContext?.primaryProduct ?? "",
      targetUsers: [...new Set(options.projectContext?.targetUsers ?? [])].sort(),
      coreEntities: [...new Set(options.projectContext?.coreEntities ?? [])].sort(),
      criticalRisks: [...new Set(options.projectContext?.criticalRisks ?? [])].sort(),
      deliveryPriorities: [...new Set(options.projectContext?.deliveryPriorities ?? [])].sort(),
      currentPainPoints: [...new Set(options.projectContext?.currentPainPoints ?? [])].sort(),
      stabilityConstraints: [
        ...new Set(options.projectContext?.stabilityConstraints ?? [])
      ].sort()
    },
    workflowState: {
      mode: "design",
      activeWorkItem: null
    },
    installedProfiles: buildInstalledProfiles({
      projectPhase,
      status: "resolved",
      frontend: options.frontend,
      backend: options.backend,
      systemType,
      architectureStyle,
      constraints,
      qualityProfiles,
      practiceProfiles
    }),
    lastResolvedAt: new Date().toISOString()
  };
}

export async function runInit(options: {
  cwd: string;
  mode?: "interactive" | "deferred";
  projectPhase?: "greenfield" | "existing";
  frontend?: string;
  backend?: string;
  systemType?: string | null;
  architectureStyle?: string | null;
  constraints?: string[];
  qualityProfiles?: string[];
  practiceProfiles?: string[];
  projectContext?: {
    primaryProduct?: string;
    targetUsers?: string[];
    coreEntities?: string[];
    criticalRisks?: string[];
    deliveryPriorities?: string[];
    currentPainPoints?: string[];
    stabilityConstraints?: string[];
  };
}): Promise<{ manifest: Manifest; updated: string[] }> {
  const cwd = await detectRepositoryRoot(options.cwd);
  const isDeferred =
    options.mode === "deferred" || !options.frontend || !options.backend;

  const frontend = options.frontend;
  const backend = options.backend;

  const manifest = applyDefaultWorkflowState(
    isDeferred
      ? {
        ...createUnresolvedManifest(),
        projectPhase: options.projectPhase ?? "greenfield",
        workflowState: {
          mode: "design" as const,
          activeWorkItem: null
        },
        installedProfiles: buildInstalledProfiles({
          projectPhase: options.projectPhase ?? "greenfield",
          status: "unresolved",
          frontend: null,
          backend: null,
          systemType: null,
          architectureStyle: null,
          constraints: [],
          qualityProfiles: [],
          practiceProfiles: []
        })
      }
      : createResolvedManifest({
        projectPhase: options.projectPhase,
        frontend: frontend as string,
        backend: backend as string,
        systemType: options.systemType,
        architectureStyle: options.architectureStyle,
        constraints: options.constraints,
        qualityProfiles: options.qualityProfiles,
        practiceProfiles: options.practiceProfiles,
        projectContext: options.projectContext
      })
  );

  const manifestErrors = validateManifest(manifest, profileRegistry);
  const templateErrors = await validateProfileRegistryTemplates(
    collectExpectedTemplateRoots(manifest, profileRegistry)
  );

  if (manifestErrors.length > 0 || templateErrors.length > 0) {
    throw new Error([...manifestErrors, ...templateErrors].join("\n"));
  }

  const collisions = await detectInitCollisions({
    cwd,
    manifest
  });

  if (collisions.length > 0) {
    throw new InitCollisionError(collisions);
  }

  const summary = await renderFoundation({
    cwd,
    manifest
  });

  return {
    manifest,
    updated: summary.updated
  };
}

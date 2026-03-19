import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { Manifest } from "./manifest.js";

const require = createRequire(import.meta.url);

type FoundationInitResult = {
  manifest: Manifest;
  updated: string[];
};

type FoundationSyncResult = {
  updated: string[];
  skipped: string[];
  conflicted: string[];
  pruned: string[];
};

type FoundationDoctorResult = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  repairCommands: string[];
};

type FoundationWorkResult = {
  manifest: Manifest;
  updated: string[];
  archived: string | null;
};

type FoundationHistoryResult =
  | {
      ok: true;
      status: "resolved" | "unresolved";
      workflowMode: "design" | "implementation" | "maintenance";
      activeWorkItem: string | null;
      archivedCount: number;
      entries: Array<{
        state: "current" | "archived";
        workItemPath: string;
        workItemTitle: string;
        completionSummary: string | null;
        lastVerifiedAt: string | null;
        handoffPath: string;
        handoffPresent: boolean;
      }>;
    }
  | {
      ok: false;
      status: "missing";
      reason: string;
    };

type FoundationRegistry = {
  version: string;
  axes: {
    phase: Record<string, unknown>;
    frontend: Record<string, unknown>;
    backend: Record<string, unknown>;
    systemType: Record<string, unknown>;
    architectureStyle: Record<string, unknown>;
    quality: Record<string, unknown>;
    practice: Record<string, unknown>;
    constraints: Record<string, unknown>;
  };
};

type FoundationInitModule = {
  runInit: (options: {
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
  }) => Promise<FoundationInitResult>;
};

type FoundationSyncModule = {
  runSync: (options: {
    cwd: string;
    dryRun?: boolean;
    repair?: boolean;
    prune?: boolean;
  }) => Promise<FoundationSyncResult>;
};

type FoundationDoctorModule = {
  runDoctor: (options: { cwd: string }) => Promise<FoundationDoctorResult>;
};

type FoundationWorkModule = {
  runWork: (options: {
    cwd: string;
    mode?: Manifest["workflowState"]["mode"];
    activeWorkItem?: string;
    archiveActive?: boolean;
  }) => Promise<FoundationWorkResult>;
};

type FoundationHistoryModule = {
  runHistory: (options: { cwd: string }) => Promise<FoundationHistoryResult>;
};

type FoundationProfileRegistryModule = {
  profileRegistry: FoundationRegistry;
};

function resolveFoundationRoot(): string {
  const packageJsonPath = require.resolve("fortheagent/package.json");
  return path.dirname(packageJsonPath);
}

async function importFoundationModule<T>(moduleRelativePath: string): Promise<T> {
  const foundationRoot = resolveFoundationRoot();
  const moduleUrl = pathToFileURL(path.join(foundationRoot, moduleRelativePath)).href;
  return (await import(moduleUrl)) as T;
}

export async function runFoundationInit(options: {
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
}): Promise<FoundationInitResult> {
  const module = await importFoundationModule<FoundationInitModule>("dist/commands/init.js");
  return module.runInit(options);
}

export async function runFoundationSync(options: {
  cwd: string;
  dryRun?: boolean;
  repair?: boolean;
  prune?: boolean;
}): Promise<FoundationSyncResult> {
  const module = await importFoundationModule<FoundationSyncModule>("dist/commands/sync.js");
  return module.runSync(options);
}

export async function runFoundationDoctor(options: {
  cwd: string;
}): Promise<FoundationDoctorResult> {
  const module = await importFoundationModule<FoundationDoctorModule>("dist/commands/doctor.js");
  return module.runDoctor(options);
}

export async function runFoundationWork(options: {
  cwd: string;
  mode?: Manifest["workflowState"]["mode"];
  activeWorkItem?: string;
  archiveActive?: boolean;
}): Promise<FoundationWorkResult> {
  const module = await importFoundationModule<FoundationWorkModule>("dist/commands/work.js");
  return module.runWork(options);
}

export async function runFoundationHistory(options: {
  cwd: string;
}): Promise<FoundationHistoryResult> {
  const module = await importFoundationModule<FoundationHistoryModule>("dist/commands/history.js");
  return module.runHistory(options);
}

export async function loadFoundationProfileRegistry(): Promise<FoundationRegistry> {
  const module = await importFoundationModule<FoundationProfileRegistryModule>(
    "dist/lib/profile-registry.js"
  );
  return module.profileRegistry;
}

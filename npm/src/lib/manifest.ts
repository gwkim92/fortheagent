import { z } from "zod";
import { profileRegistry, type ProfileRegistry } from "./profile-registry.js";

export const manifestSchema = z.object({
  version: z.string(),
  foundationVersion: z.string(),
  generatedAt: z.string().default("1970-01-01T00:00:00.000Z"),
  status: z.union([z.literal("resolved"), z.literal("unresolved")]),
  projectPhase: z.union([z.literal("greenfield"), z.literal("existing")]),
  frontend: z.string().nullable(),
  backend: z.string().nullable(),
  systemType: z.string().nullable(),
  architectureStyle: z.string().nullable(),
  constraints: z.array(z.string()),
  qualityProfiles: z.array(z.string()),
  practiceProfiles: z.array(z.string()),
  projectContext: z.object({
    primaryProduct: z.string(),
    targetUsers: z.array(z.string()),
    coreEntities: z.array(z.string()),
    criticalRisks: z.array(z.string()),
    deliveryPriorities: z.array(z.string()),
    currentPainPoints: z.array(z.string()),
    stabilityConstraints: z.array(z.string())
  }),
  workflowState: z
    .object({
      mode: z.union([
        z.literal("design"),
        z.literal("implementation"),
        z.literal("maintenance")
      ]),
      activeWorkItem: z.string().nullable()
    })
    .default({
      mode: "design",
      activeWorkItem: null
    }),
  installedProfiles: z.array(z.string()),
  lastResolvedAt: z.string().nullable()
});

export type Manifest = z.infer<typeof manifestSchema>;

const supportedManifestVersion = "0.1.0";

type InstalledProfilesInput = Pick<
  Manifest,
  | "projectPhase"
  | "status"
  | "frontend"
  | "backend"
  | "systemType"
  | "architectureStyle"
  | "constraints"
  | "qualityProfiles"
  | "practiceProfiles"
>;

function isKnownAxisValue(
  axisValues: Record<string, unknown>,
  value: string | null
): boolean {
  return value === null || value in axisValues;
}

export function buildInstalledProfiles(input: InstalledProfilesInput): string[] {
  const baseProfiles = ["base", `phase:${input.projectPhase}`];

  if (input.status === "unresolved") {
    return baseProfiles;
  }

  return [
    ...baseProfiles,
    `frontend:${input.frontend}`,
    `backend:${input.backend}`,
    `system:${input.systemType}`,
    `architecture:${input.architectureStyle}`,
    ...[...input.qualityProfiles].sort().map((profile) => `quality:${profile}`),
    ...[...input.practiceProfiles].sort().map((profile) => `practice:${profile}`),
    ...[...input.constraints].sort().map((constraint) => `constraint:${constraint}`)
  ];
}

export function parseManifest(input: unknown): Manifest {
  return manifestSchema.parse(input);
}

export function validateManifest(
  manifest: Manifest,
  registry: ProfileRegistry = profileRegistry
): string[] {
  const errors: string[] = [];

  if (manifest.version !== supportedManifestVersion) {
    errors.push(`Unsupported manifest version: ${manifest.version}`);
  }

  if (Number.isNaN(Date.parse(manifest.generatedAt))) {
    errors.push(`Invalid generatedAt timestamp: ${manifest.generatedAt}`);
  }

  if (!(manifest.projectPhase in registry.axes.phase)) {
    errors.push(`Unknown project phase: ${manifest.projectPhase}`);
  }

  const expectedInstalledProfiles = buildInstalledProfiles(manifest);
  const missingInstalledProfiles = expectedInstalledProfiles.filter(
    (profile) => !manifest.installedProfiles.includes(profile)
  );
  const unexpectedInstalledProfiles = manifest.installedProfiles.filter(
    (profile) => !expectedInstalledProfiles.includes(profile)
  );

  if (missingInstalledProfiles.length > 0) {
    errors.push(
      `Manifest validation failed: missing installedProfiles entries: ${missingInstalledProfiles.join(", ")}`
    );
  }

  if (unexpectedInstalledProfiles.length > 0) {
    errors.push(
      `Manifest validation failed: unexpected installedProfiles entries: ${unexpectedInstalledProfiles.join(", ")}`
    );
  }

  if (
    missingInstalledProfiles.length === 0 &&
    unexpectedInstalledProfiles.length === 0 &&
    JSON.stringify(manifest.installedProfiles) !==
      JSON.stringify(expectedInstalledProfiles)
  ) {
    errors.push(
      `Manifest validation failed: installedProfiles must use canonical order: ${expectedInstalledProfiles.join(", ")}`
    );
  }

  if (!isKnownAxisValue(registry.axes.frontend, manifest.frontend)) {
    errors.push(`Unknown frontend profile: ${manifest.frontend}`);
  }

  if (!isKnownAxisValue(registry.axes.backend, manifest.backend)) {
    errors.push(`Unknown backend profile: ${manifest.backend}`);
  }

  if (!isKnownAxisValue(registry.axes.systemType, manifest.systemType)) {
    errors.push(`Unknown system type: ${manifest.systemType}`);
  }

  if (!isKnownAxisValue(registry.axes.architectureStyle, manifest.architectureStyle)) {
    errors.push(`Unknown architecture style: ${manifest.architectureStyle}`);
  }

  for (const constraint of manifest.constraints) {
    if (!(constraint in registry.axes.constraints)) {
      errors.push(`Unknown constraint: ${constraint}`);
    }
  }

  for (const qualityProfile of manifest.qualityProfiles) {
    if (!(qualityProfile in registry.axes.quality)) {
      errors.push(`Unknown quality profile: ${qualityProfile}`);
    }
  }

  for (const practiceProfile of manifest.practiceProfiles) {
    if (!(practiceProfile in registry.axes.practice)) {
      errors.push(`Unknown practice profile: ${practiceProfile}`);
    }
  }

  if (manifest.status === "resolved") {
    if (
      manifest.frontend === null ||
      manifest.backend === null ||
      manifest.systemType === null ||
      manifest.architectureStyle === null
    ) {
      errors.push("Resolved manifest must not contain null axis values");
    }

    if (manifest.lastResolvedAt === null) {
      errors.push("Resolved manifest must include lastResolvedAt");
    } else if (Number.isNaN(Date.parse(manifest.lastResolvedAt))) {
      errors.push(`Invalid lastResolvedAt timestamp: ${manifest.lastResolvedAt}`);
    }
  }

  if (manifest.status === "unresolved" && manifest.lastResolvedAt !== null) {
    errors.push("Unresolved manifest must not include lastResolvedAt");
  }

  if (
    manifest.workflowState.mode !== "design" &&
    manifest.workflowState.mode !== "implementation" &&
    manifest.workflowState.mode !== "maintenance"
  ) {
    errors.push(`Unknown workflow mode: ${manifest.workflowState.mode}`);
  }

  return errors;
}

export function createUnresolvedManifest(version = "0.1.0"): Manifest {
  const generatedAt = new Date().toISOString();

  return {
    version,
    foundationVersion: version,
    generatedAt,
    status: "unresolved",
    projectPhase: "greenfield",
    frontend: null,
    backend: null,
    systemType: null,
    architectureStyle: null,
    constraints: [],
    qualityProfiles: [],
    practiceProfiles: [],
    projectContext: {
      primaryProduct: "",
      targetUsers: [],
      coreEntities: [],
      criticalRisks: [],
      deliveryPriorities: [],
      currentPainPoints: [],
      stabilityConstraints: []
    },
    workflowState: {
      mode: "design",
      activeWorkItem: null
    },
    installedProfiles: buildInstalledProfiles({
      projectPhase: "greenfield",
      status: "unresolved",
      frontend: null,
      backend: null,
      systemType: null,
      architectureStyle: null,
      constraints: [],
      qualityProfiles: [],
      practiceProfiles: []
    }),
    lastResolvedAt: null
  };
}

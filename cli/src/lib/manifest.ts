import { z } from "zod";
import { profileRegistry, type ProjectPhase } from "./profile-registry.js";

const projectContextSchema = z.object({
  primaryProduct: z.string(),
  targetUsers: z.array(z.string()),
  coreEntities: z.array(z.string()),
  criticalRisks: z.array(z.string()),
  deliveryPriorities: z.array(z.string()),
  currentPainPoints: z.array(z.string()),
  stabilityConstraints: z.array(z.string())
});

const canonicalManifestSchema = z.object({
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
  projectContext: projectContextSchema,
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

const legacyManifestSchema = z.object({
  version: z.string(),
  status: z.union([z.literal("resolved"), z.literal("unresolved")]),
  frontend: z.string().nullable(),
  backend: z.string().nullable(),
  systemType: z.string().nullable(),
  architectureStyle: z.string().nullable(),
  constraints: z.array(z.string()),
  qualityProfiles: z.array(z.string()),
  lastResolvedAt: z.string().nullable()
});

export type Manifest = z.infer<typeof canonicalManifestSchema>;
export type LegacyManifest = z.infer<typeof legacyManifestSchema>;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function buildInstalledProfiles(input: {
  projectPhase: ProjectPhase;
  status: "resolved" | "unresolved";
  frontend: string | null;
  backend: string | null;
  systemType: string | null;
  architectureStyle: string | null;
  constraints: string[];
  qualityProfiles: string[];
  practiceProfiles: string[];
}): string[] {
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
    ...unique(input.qualityProfiles).map((profile) => `quality:${profile}`),
    ...unique(input.practiceProfiles).map((profile) => `practice:${profile}`),
    ...unique(input.constraints).map((constraint) => `constraint:${constraint}`)
  ];
}

export function createEmptyProjectContext(): Manifest["projectContext"] {
  return {
    primaryProduct: "",
    targetUsers: [],
    coreEntities: [],
    criticalRisks: [],
    deliveryPriorities: [],
    currentPainPoints: [],
    stabilityConstraints: []
  };
}

export function createCanonicalManifestFromLegacy(input: LegacyManifest): Manifest {
  const projectPhase: ProjectPhase = "greenfield";
  const constraints = unique(input.constraints);
  const qualityProfiles = unique(input.qualityProfiles);
  const practiceProfiles: string[] = [];

  return {
    version: input.version,
    foundationVersion: input.version,
    generatedAt: input.lastResolvedAt ?? "1970-01-01T00:00:00.000Z",
    status: input.status,
    projectPhase,
    frontend: input.frontend,
    backend: input.backend,
    systemType: input.systemType,
    architectureStyle: input.architectureStyle,
    constraints,
    qualityProfiles,
    practiceProfiles,
    projectContext: createEmptyProjectContext(),
    workflowState: {
      mode: "design",
      activeWorkItem: null
    },
    installedProfiles: buildInstalledProfiles({
      projectPhase,
      status: input.status,
      frontend: input.status === "resolved" ? input.frontend : null,
      backend: input.status === "resolved" ? input.backend : null,
      systemType: input.status === "resolved" ? input.systemType : null,
      architectureStyle: input.status === "resolved" ? input.architectureStyle : null,
      constraints: input.status === "resolved" ? constraints : [],
      qualityProfiles: input.status === "resolved" ? qualityProfiles : [],
      practiceProfiles
    }),
    lastResolvedAt: input.status === "resolved" ? input.lastResolvedAt : null
  };
}

export function parseManifest(input: unknown): Manifest {
  return parseManifestCompat(input).manifest;
}

export function parseLegacyManifest(input: unknown): LegacyManifest {
  return legacyManifestSchema.parse(input);
}

export function parseManifestCompat(input: unknown): {
  manifest: Manifest;
  legacy: boolean;
} {
  const canonical = canonicalManifestSchema.safeParse(input);

  if (canonical.success) {
    return {
      manifest: canonical.data,
      legacy: false
    };
  }

  const legacy = legacyManifestSchema.parse(input);
  return {
    manifest: createCanonicalManifestFromLegacy(legacy),
    legacy: true
  };
}

export function isKnownProfileValue(
  axisValues: readonly string[],
  value: string | null
): boolean {
  return value === null || axisValues.includes(value);
}

export function validateManifest(manifest: Manifest): string[] {
  const errors: string[] = [];
  const expectedInstalledProfiles = buildInstalledProfiles(manifest);
  const constraints = new Set<string>(profileRegistry.constraints);
  const qualityProfiles = new Set<string>(profileRegistry.qualityProfiles);
  const practiceProfiles = new Set<string>(profileRegistry.practiceProfiles);

  if (!profileRegistry.projectPhase.includes(manifest.projectPhase)) {
    errors.push(`Unknown project phase: ${manifest.projectPhase}`);
  }

  if (!isKnownProfileValue(profileRegistry.frontend, manifest.frontend)) {
    errors.push(`Unknown frontend profile: ${manifest.frontend}`);
  }

  if (!isKnownProfileValue(profileRegistry.backend, manifest.backend)) {
    errors.push(`Unknown backend profile: ${manifest.backend}`);
  }

  if (!isKnownProfileValue(profileRegistry.systemType, manifest.systemType)) {
    errors.push(`Unknown system type: ${manifest.systemType}`);
  }

  if (!isKnownProfileValue(profileRegistry.architectureStyle, manifest.architectureStyle)) {
    errors.push(`Unknown architecture style: ${manifest.architectureStyle}`);
  }

  for (const constraint of manifest.constraints) {
    if (!constraints.has(constraint)) {
      errors.push(`Unknown constraint: ${constraint}`);
    }
  }

  for (const qualityProfile of manifest.qualityProfiles) {
    if (!qualityProfiles.has(qualityProfile)) {
      errors.push(`Unknown quality profile: ${qualityProfile}`);
    }
  }

  for (const practiceProfile of manifest.practiceProfiles) {
    if (!practiceProfiles.has(practiceProfile)) {
      errors.push(`Unknown practice profile: ${practiceProfile}`);
    }
  }

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
    JSON.stringify(manifest.installedProfiles) !== JSON.stringify(expectedInstalledProfiles)
  ) {
    errors.push(
      `Manifest validation failed: installedProfiles must use canonical order: ${expectedInstalledProfiles.join(", ")}`
    );
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

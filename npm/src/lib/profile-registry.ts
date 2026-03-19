import { access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { Manifest } from "./manifest.js";
import { resolvePackageRoot } from "./paths.js";

export const PROFILE_REGISTRY_VERSION = "0.1.0";
export const PROFILE_REGISTRY_MIGRATION_TARGET = PROFILE_REGISTRY_VERSION;

const registryEntrySchema = z.object({
  templates: z.array(z.string()),
  outputs: z.array(z.string())
});

export const profileRegistrySchema = z.object({
  version: z.string(),
  axes: z.object({
    phase: z.record(z.string(), registryEntrySchema),
    frontend: z.record(z.string(), registryEntrySchema),
    backend: z.record(z.string(), registryEntrySchema),
    systemType: z.record(z.string(), registryEntrySchema),
    architectureStyle: z.record(z.string(), registryEntrySchema),
    quality: z.record(z.string(), registryEntrySchema),
    practice: z.record(z.string(), registryEntrySchema),
    constraints: z.record(z.string(), registryEntrySchema)
  })
});

const legacyProfileRegistrySchemaV0 = z.object({
  version: z.literal("0.0.0"),
  axes: z.object({
    phase: z.record(z.string(), registryEntrySchema).optional(),
    frontend: z.record(z.string(), registryEntrySchema),
    backend: z.record(z.string(), registryEntrySchema),
    systemType: z.record(z.string(), registryEntrySchema),
    quality: z.record(z.string(), registryEntrySchema),
    practice: z.record(z.string(), registryEntrySchema).optional(),
    constraints: z.record(z.string(), registryEntrySchema)
  })
});

export const profileRegistry = profileRegistrySchema.parse({
  version: PROFILE_REGISTRY_VERSION,
  axes: {
    phase: {
      greenfield: {
        templates: [],
        outputs: []
      },
      existing: {
        templates: ["templates/phase/existing"],
        outputs: [
          "docs/architecture/current-state.md",
          "docs/architecture/refactor-target.md",
          "docs/engineering/current-delivery-risks.md",
          "docs/engineering/migration-plan.md"
        ]
      }
    },
    frontend: {
      next: {
        templates: ["templates/frontend/next"],
        outputs: [
          "docs/architecture/frontend.md",
          ".claude/rules/frontend.md",
          ".cursor/rules/frontend.mdc"
        ]
      },
      "react-spa": {
        templates: ["templates/frontend/react-spa"],
        outputs: [
          "docs/architecture/frontend.md",
          ".claude/rules/frontend.md",
          ".cursor/rules/frontend.mdc"
        ]
      },
      none: {
        templates: [],
        outputs: []
      }
    },
    backend: {
      nest: {
        templates: ["templates/backend/nest"],
        outputs: ["docs/architecture/backend.md"]
      },
      fastify: {
        templates: ["templates/backend/fastify"],
        outputs: ["docs/architecture/backend.md"]
      },
      serverless: {
        templates: ["templates/backend/serverless"],
        outputs: ["docs/architecture/backend.md"]
      },
      none: {
        templates: [],
        outputs: []
      }
    },
    systemType: {
      "internal-tool": {
        templates: ["templates/system/internal-tool"],
        outputs: ["docs/system/overview.md"]
      },
      "b2b-saas": {
        templates: ["templates/system/b2b-saas"],
        outputs: ["docs/system/overview.md"]
      },
      "content-site": {
        templates: ["templates/system/content-site"],
        outputs: ["docs/system/overview.md"]
      },
      "api-platform": {
        templates: ["templates/system/api-platform"],
        outputs: ["docs/system/overview.md"]
      },
      "realtime-app": {
        templates: ["templates/system/realtime-app"],
        outputs: ["docs/system/overview.md"]
      },
      "data-platform": {
        templates: ["templates/system/data-platform"],
        outputs: ["docs/system/overview.md"]
      }
    },
    architectureStyle: {
      monolith: {
        templates: [],
        outputs: []
      },
      "modular-monolith": {
        templates: [],
        outputs: []
      },
      "service-oriented": {
        templates: [],
        outputs: []
      },
      "event-driven": {
        templates: [],
        outputs: []
      }
    },
    quality: {
      "ci-basic": {
        templates: ["templates/quality/ci-basic"],
        outputs: [".github/workflows/ci.yml"]
      }
    },
    practice: {
      "ddd-core": {
        templates: ["templates/practice/ddd-core"],
        outputs: ["docs/practices/ddd-core.md"]
      },
      "tdd-first": {
        templates: ["templates/practice/tdd-first"],
        outputs: ["docs/practices/tdd-first.md"]
      },
      "strict-verification": {
        templates: ["templates/practice/strict-verification"],
        outputs: ["docs/practices/strict-verification.md"]
      }
    },
    constraints: {
      seo: {
        templates: ["templates/constraints/seo"],
        outputs: ["docs/product/constraints/seo.md"]
      },
      auth: {
        templates: ["templates/constraints/auth"],
        outputs: [
          "docs/product/constraints/auth.md",
          ".claude/rules/auth.md",
          ".cursor/rules/auth.mdc"
        ]
      },
      payments: {
        templates: ["templates/constraints/payments"],
        outputs: [
          "docs/product/constraints/payments.md",
          ".claude/rules/payments.md",
          ".cursor/rules/payments.mdc"
        ]
      },
      "multi-tenant": {
        templates: ["templates/constraints/multi-tenant"],
        outputs: ["docs/product/constraints/multi-tenant.md"]
      },
      pii: {
        templates: ["templates/constraints/pii"],
        outputs: ["docs/product/constraints/pii.md"]
      },
      offline: {
        templates: ["templates/constraints/offline"],
        outputs: ["docs/product/constraints/offline.md"]
      },
      realtime: {
        templates: ["templates/constraints/realtime"],
        outputs: ["docs/product/constraints/realtime.md"]
      }
    }
  }
});

export type ProfileRegistry = z.infer<typeof profileRegistrySchema>;

type RegistryEntry = z.infer<typeof registryEntrySchema>;

export type LoadedProfileRegistry = {
  registry: ProfileRegistry;
  migratedFrom: string | null;
  needsRewrite: boolean;
};

export function parseProfileRegistry(input: unknown): ProfileRegistry {
  return profileRegistrySchema.parse(input);
}

export function loadProfileRegistry(input: unknown): LoadedProfileRegistry {
  const current = profileRegistrySchema.safeParse(input);

  if (current.success) {
    return {
      registry: current.data,
      migratedFrom: null,
      needsRewrite: false
    };
  }

  const legacyV0 = legacyProfileRegistrySchemaV0.safeParse(input);

  if (legacyV0.success) {
    return {
      registry: profileRegistrySchema.parse({
        version: PROFILE_REGISTRY_MIGRATION_TARGET,
        axes: {
          phase: profileRegistry.axes.phase,
          ...legacyV0.data.axes,
          architectureStyle: profileRegistry.axes.architectureStyle,
          practice: profileRegistry.axes.practice
        }
      }),
      migratedFrom: legacyV0.data.version,
      needsRewrite: true
    };
  }

  return {
    registry: parseProfileRegistry(input),
    migratedFrom: null,
    needsRewrite: false
  };
}

export function validateProfileRegistry(registry: ProfileRegistry): string[] {
  const errors: string[] = [];

  if (registry.version !== PROFILE_REGISTRY_VERSION) {
    errors.push(`Unsupported profile registry version: ${registry.version}`);
  }

  for (const [axisName, axisValues] of Object.entries(registry.axes)) {
    if (Object.keys(axisValues).length === 0) {
      errors.push(`Profile registry axis has no values: ${axisName}`);
      continue;
    }

    for (const [profileName, entry] of Object.entries(axisValues)) {
      for (const template of entry.templates) {
        if (!template.startsWith("templates/")) {
          errors.push(
            `Invalid template root for ${axisName}:${profileName}: ${template}`
          );
        }
      }

      for (const output of entry.outputs) {
        if (
          output.startsWith("/") ||
          output.split("/").includes("..") ||
          output.length === 0
        ) {
          errors.push(`Invalid output path for ${axisName}:${profileName}: ${output}`);
        }
      }
    }
  }

  return errors;
}

function pushRegistryEntry(
  entries: RegistryEntry[],
  axis: Record<string, RegistryEntry>,
  profile: string | null
): void {
  if (profile === null || profile === "none") {
    return;
  }

  const entry = axis[profile];

  if (entry) {
    entries.push(entry);
  }
}

export function collectSelectedRegistryEntries(
  manifest: Manifest,
  registry: ProfileRegistry
): RegistryEntry[] {
  const entries: RegistryEntry[] = [];

  pushRegistryEntry(entries, registry.axes.phase, manifest.projectPhase);

  if (manifest.status !== "resolved") {
    return entries;
  }

  pushRegistryEntry(entries, registry.axes.frontend, manifest.frontend);
  pushRegistryEntry(entries, registry.axes.backend, manifest.backend);
  pushRegistryEntry(entries, registry.axes.systemType, manifest.systemType);
  pushRegistryEntry(
    entries,
    registry.axes.architectureStyle,
    manifest.architectureStyle
  );

  for (const qualityProfile of manifest.qualityProfiles) {
    pushRegistryEntry(entries, registry.axes.quality, qualityProfile);
  }

  for (const practiceProfile of manifest.practiceProfiles) {
    pushRegistryEntry(entries, registry.axes.practice, practiceProfile);
  }

  for (const constraint of manifest.constraints) {
    pushRegistryEntry(entries, registry.axes.constraints, constraint);
  }

  return entries;
}

export function collectExpectedOutputs(
  manifest: Manifest,
  registry: ProfileRegistry
): string[] {
  return Array.from(
    new Set(
      collectSelectedRegistryEntries(manifest, registry).flatMap((entry) => entry.outputs)
    )
  ).sort();
}

export function collectExpectedTemplateRoots(
  manifest: Manifest,
  registry: ProfileRegistry
): string[] {
  return Array.from(
    new Set(
      collectSelectedRegistryEntries(manifest, registry).flatMap((entry) => entry.templates)
    )
  ).sort();
}

export function collectKnownOverlayOutputs(registry: ProfileRegistry): string[] {
  return Array.from(
    new Set(
      Object.values(registry.axes).flatMap((axis) =>
        Object.values(axis).flatMap((entry) => entry.outputs)
      )
    )
  ).sort();
}

export async function validateProfileRegistryTemplates(
  templateRoots: string[]
): Promise<string[]> {
  const errors: string[] = [];
  const packageRoot = resolvePackageRoot();

  for (const templateRoot of new Set(templateRoots)) {
    try {
      await access(path.join(packageRoot, templateRoot));
    } catch {
      errors.push(`Missing template root in package: ${templateRoot}`);
    }
  }

  return errors.sort();
}

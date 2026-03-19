import { buildInstalledProfiles, type Manifest } from "./manifest.js";
import {
  profileRegistry,
  validateProfileRegistryTemplates
} from "./profile-registry.js";
import type { RepositoryScan } from "./repo-scan.js";
import type { SelectionInput } from "./selection.js";
import { listTemplateFiles, toRepositoryPath } from "./templates.js";

export type PromptDefaults = Partial<SelectionInput>;

export type SingleChoiceLabel =
  | "projectPhase"
  | "frontend"
  | "backend"
  | "systemType"
  | "architectureStyle";

export type MultiChoiceLabel = "constraints" | "qualityProfiles" | "practiceProfiles";
export type PromptLabel = SingleChoiceLabel | MultiChoiceLabel;

export type PromptOptionSet = {
  projectPhase: string[];
  frontend: string[];
  backend: string[];
  systemType: string[];
  architectureStyle: string[];
  constraints: string[];
  qualityProfiles: string[];
  practiceProfiles: string[];
};

export type OptionCopy = {
  label: string;
  description?: string;
};

export const defaultPracticeProfiles = [
  "ddd-core",
  "tdd-first",
  "strict-verification"
] as const;

export const optionCopy: Record<PromptLabel, Record<string, OptionCopy>> = {
  projectPhase: {
    greenfield: {
      label: "New Project",
      description: "Start from intended product and target design."
    },
    existing: {
      label: "Existing Repository",
      description: "Capture current state, target state, and migration steps."
    }
  },
  frontend: {
    next: {
      label: "Next.js",
      description: "React app with routing and server rendering."
    },
    "react-spa": {
      label: "React SPA",
      description: "Client-rendered React app without SSR."
    },
    none: {
      label: "No Frontend",
      description: "This repo does not own a user-facing frontend."
    }
  },
  backend: {
    nest: {
      label: "NestJS",
      description: "Structured Node.js backend with modules and DI."
    },
    fastify: {
      label: "Fastify",
      description: "Lightweight Node.js API focused on speed."
    },
    serverless: {
      label: "Serverless Functions",
      description: "Backend logic runs as cloud functions."
    },
    none: {
      label: "No Backend",
      description: "This repo does not own an API or backend."
    }
  },
  systemType: {
    "internal-tool": {
      label: "Internal Tool",
      description: "Used by your own team or company."
    },
    "b2b-saas": {
      label: "B2B SaaS",
      description: "A customer-facing SaaS product used by external companies or teams."
    },
    "content-site": {
      label: "Content Site",
      description: "A marketing, editorial, or content-heavy website where publishing matters."
    },
    "api-platform": {
      label: "API Platform",
      description: "A backend-first product where APIs are the main product surface."
    },
    "realtime-app": {
      label: "Realtime App",
      description: "A product centered on live updates, collaboration, or streaming state."
    },
    "data-platform": {
      label: "Data Platform",
      description: "A system for ingestion, processing, analytics, or internal data operations."
    }
  },
  architectureStyle: {
    monolith: {
      label: "Monolith",
      description: "One deployable app with shared runtime boundaries."
    },
    "modular-monolith": {
      label: "Modular Monolith",
      description: "One app, but split into clearer internal modules."
    },
    "service-oriented": {
      label: "Service-Oriented",
      description: "Multiple services with explicit boundaries."
    },
    "event-driven": {
      label: "Event-Driven",
      description: "Heavy use of events, queues, or async pipelines."
    }
  },
  constraints: {
    seo: {
      label: "SEO and Discoverability",
      description: "Search traffic and metadata quality matter."
    },
    auth: {
      label: "Authentication and Access Control",
      description: "Login, roles, or permissions are important."
    },
    payments: {
      label: "Payments and Billing",
      description: "Charges, subscriptions, or billing are involved."
    },
    "multi-tenant": {
      label: "Multi-Tenant Data Separation",
      description: "Multiple customers must stay isolated."
    },
    pii: {
      label: "Personal Data Handling",
      description: "This system stores or processes personal data."
    },
    offline: {
      label: "Offline Workflows",
      description: "Some tasks should work with weak or missing connectivity."
    },
    realtime: {
      label: "Realtime Updates",
      description: "Users expect live updates or instant sync."
    }
  },
  qualityProfiles: {
    "ci-basic": {
      label: "Basic CI Checks",
      description: "Adds a starter CI workflow."
    }
  },
  practiceProfiles: {
    "ddd-core": {
      label: "DDD Core",
      description: "Promote domain language, boundaries, and aggregates in the design pack."
    },
    "tdd-first": {
      label: "TDD First",
      description: "Bias the design toward red-green-refactor and test-first delivery."
    },
    "strict-verification": {
      label: "Strict Verification",
      description: "Require explicit verification evidence for major claims."
    }
  }
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function pickFirstMatchingOption(
  hints: string[],
  options: readonly string[]
): string | undefined {
  return hints.find((hint) => options.includes(hint));
}

export function getOptionCopy(label: PromptLabel, option: string): OptionCopy {
  return optionCopy[label][option] ?? {
    label: option
  };
}

export function formatOptionValue(label: PromptLabel, option: string): string {
  return getOptionCopy(label, option).label;
}

export function formatSelection(selection: SelectionInput): string[] {
  const rows = [
    ["Project Phase", formatOptionValue("projectPhase", selection.projectPhase)],
    ["Frontend", selection.frontend ? formatOptionValue("frontend", selection.frontend) : "none"],
    ["Backend", selection.backend ? formatOptionValue("backend", selection.backend) : "none"],
    [
      "Project Type",
      selection.systemType ? formatOptionValue("systemType", selection.systemType) : "none"
    ],
    [
      "Structure",
      selection.architectureStyle
        ? formatOptionValue("architectureStyle", selection.architectureStyle)
        : "none"
    ],
    [
      "Additional Requirements",
      selection.constraints.map((item) => formatOptionValue("constraints", item)).join(", ") ||
        "none"
    ],
    [
      "Automation and Quality",
      selection.qualityProfiles
        .map((item) => formatOptionValue("qualityProfiles", item))
        .join(", ") || "none"
    ],
    [
      "Engineering Practices",
      selection.practiceProfiles
        .map((item) => formatOptionValue("practiceProfiles", item))
        .join(", ") || "none"
    ],
    ["Primary Product", selection.primaryProduct || "unconfirmed"],
    ["Target Users", selection.targetUsers.join(", ") || "unconfirmed"],
    ["Core Entities", selection.coreEntities.join(", ") || "unconfirmed"],
    ["Critical Risks", selection.criticalRisks.join(", ") || "unconfirmed"],
    ["Delivery Priorities", selection.deliveryPriorities.join(", ") || "unconfirmed"],
    ...(selection.projectPhase === "existing"
      ? ([
          ["Current Pain Points", selection.currentPainPoints.join(", ") || "unconfirmed"],
          [
            "Stability Constraints",
            selection.stabilityConstraints.join(", ") || "unconfirmed"
          ]
        ] as const)
      : [])
  ] as const;
  const labelWidth = Math.max(...rows.map(([label]) => label.length));

  return rows.map(([label, value]) => `  ${label.padEnd(labelWidth)} : ${value ?? "none"}`);
}

export function resolveOptionInput(
  answer: string,
  options: readonly string[]
): string | null {
  if (!answer) {
    return null;
  }

  if (/^\d+$/.test(answer)) {
    const selectedIndex = Number(answer) - 1;
    return options[selectedIndex] ?? null;
  }

  return options.includes(answer) ? answer : null;
}

export function resolveMultiOptionInput(
  answer: string,
  options: readonly string[]
): string[] | null {
  if (!answer) {
    return [];
  }

  const resolved: string[] = [];

  for (const token of answer.split(",").map((part) => part.trim()).filter(Boolean)) {
    const option = resolveOptionInput(token, options);

    if (!option) {
      return null;
    }

    if (!resolved.includes(option)) {
      resolved.push(option);
    }
  }

  return resolved;
}

function normalizeMultiSelect(
  label: MultiChoiceLabel,
  values: string[],
  options: readonly string[]
): string[] {
  const allowed = new Set(options);
  const normalized = values.map((value) => value.trim()).filter(Boolean);

  for (const value of normalized) {
    if (!allowed.has(value)) {
      throw new Error(`Invalid ${label} value: ${value}`);
    }
  }

  return normalized;
}

function ensureAllowed(
  field: SingleChoiceLabel,
  value: string,
  options: readonly string[]
): string {
  if (!options.includes(value)) {
    throw new Error(`Invalid ${field} value: ${value}`);
  }

  return value;
}

export async function collectImplementedOptions(
  axis: Record<string, { templates: string[] }>
): Promise<string[]> {
  const options: string[] = [];

  for (const [profileName, entry] of Object.entries(axis)) {
    const errors = await validateProfileRegistryTemplates(entry.templates);

    if (errors.length === 0) {
      options.push(profileName);
    }
  }

  return options;
}

export async function resolvePromptOptions(): Promise<PromptOptionSet> {
  return {
    projectPhase: await collectImplementedOptions(profileRegistry.axes.phase),
    frontend: await collectImplementedOptions(profileRegistry.axes.frontend),
    backend: await collectImplementedOptions(profileRegistry.axes.backend),
    systemType: await collectImplementedOptions(profileRegistry.axes.systemType),
    architectureStyle: await collectImplementedOptions(profileRegistry.axes.architectureStyle),
    constraints: await collectImplementedOptions(profileRegistry.axes.constraints),
    qualityProfiles: await collectImplementedOptions(profileRegistry.axes.quality),
    practiceProfiles: await collectImplementedOptions(profileRegistry.axes.practice)
  };
}

export function inferDefaultsFromScan(
  scan: RepositoryScan | undefined,
  options: PromptOptionSet
): PromptDefaults {
  if (!scan) {
    return {};
  }

  const frontend = pickFirstMatchingOption(scan.frontendHints, options.frontend);
  const backend = pickFirstMatchingOption(scan.backendHints, options.backend);
  const systemType = pickFirstMatchingOption(scan.systemTypeHints, options.systemType);
  const architectureStyle = pickFirstMatchingOption(
    scan.architectureStyleHints,
    options.architectureStyle
  );

  return {
    ...(options.projectPhase.includes(scan.phaseRecommendation)
      ? { projectPhase: scan.phaseRecommendation }
      : {}),
    ...(frontend ? { frontend } : {}),
    ...(backend ? { backend } : {}),
    ...(systemType ? { systemType } : {}),
    ...(architectureStyle ? { architectureStyle } : {})
  };
}

export function normalizeAnswers(
  answerSet: Partial<SelectionInput>,
  options: PromptOptionSet,
  defaults: PromptDefaults = {}
): SelectionInput {
  const merged = {
    ...defaults,
    ...answerSet
  };

  return {
    projectPhase:
      (merged.projectPhase as "greenfield" | "existing" | undefined) ?? "greenfield",
    frontend: ensureAllowed("frontend", merged.frontend ?? "none", options.frontend),
    backend: ensureAllowed("backend", merged.backend ?? "none", options.backend),
    systemType: ensureAllowed(
      "systemType",
      merged.systemType ?? "internal-tool",
      options.systemType
    ),
    architectureStyle: ensureAllowed(
      "architectureStyle",
      merged.architectureStyle ?? "monolith",
      options.architectureStyle
    ),
    constraints: normalizeMultiSelect("constraints", merged.constraints ?? [], options.constraints),
    qualityProfiles: normalizeMultiSelect(
      "qualityProfiles",
      merged.qualityProfiles ?? [],
      options.qualityProfiles
    ),
    practiceProfiles: normalizeMultiSelect(
      "practiceProfiles",
      merged.practiceProfiles ?? [...defaultPracticeProfiles],
      options.practiceProfiles
    ),
    primaryProduct: (merged.primaryProduct ?? "").trim(),
    targetUsers: unique(merged.targetUsers ?? []),
    coreEntities: unique(merged.coreEntities ?? []),
    criticalRisks: unique(merged.criticalRisks ?? []),
    deliveryPriorities: unique(merged.deliveryPriorities ?? []),
    currentPainPoints: unique(merged.currentPainPoints ?? []),
    stabilityConstraints: unique(merged.stabilityConstraints ?? [])
  };
}

function createPreviewManifest(selection: SelectionInput): Manifest {
  return {
    version: "0.1.0",
    foundationVersion: "0.1.0",
    generatedAt: "preview",
    status: "resolved",
    projectPhase: selection.projectPhase,
    frontend: selection.frontend,
    backend: selection.backend,
    systemType: selection.systemType,
    architectureStyle: selection.architectureStyle,
    constraints: selection.constraints,
    qualityProfiles: selection.qualityProfiles,
    practiceProfiles: selection.practiceProfiles,
    projectContext: {
      primaryProduct: selection.primaryProduct,
      targetUsers: selection.targetUsers,
      coreEntities: selection.coreEntities,
      criticalRisks: selection.criticalRisks,
      deliveryPriorities: selection.deliveryPriorities,
      currentPainPoints: selection.currentPainPoints,
      stabilityConstraints: selection.stabilityConstraints
    },
    installedProfiles: buildInstalledProfiles({
      projectPhase: selection.projectPhase,
      status: "resolved",
      frontend: selection.frontend,
      backend: selection.backend,
      systemType: selection.systemType,
      architectureStyle: selection.architectureStyle,
      constraints: selection.constraints,
      qualityProfiles: selection.qualityProfiles,
      practiceProfiles: selection.practiceProfiles
    }),
    workflowState: {
      mode: "design",
      activeWorkItem: null
    },
    lastResolvedAt: "preview"
  };
}

function previewFilePriority(file: string): number {
  if (file === "AGENTS.md" || file === "CLAUDE.md" || file === "GEMINI.md") {
    return 0;
  }

  if (file.startsWith("docs/")) {
    return 1;
  }

  if (file.startsWith(".github/")) {
    return 2;
  }

  if (
    file.startsWith(".claude/") ||
    file.startsWith(".cursor/") ||
    file.startsWith(".agents/")
  ) {
    return 3;
  }

  if (file.startsWith(".agent-foundation/")) {
    return 4;
  }

  return 5;
}

export async function buildGeneratedFilePreview(selection: SelectionInput): Promise<string[]> {
  const manifest = createPreviewManifest(selection);
  const templateFiles = await listTemplateFiles(manifest, profileRegistry);
  const repositoryFiles = templateFiles.map((templateFile) => toRepositoryPath(templateFile));

  return Array.from(
    new Set([
      ...repositoryFiles,
      ".agent-foundation/context-budget.json",
      ".agent-foundation/manifest.json",
      ".agent-foundation/profile-registry.json",
      ".agent-foundation/provider-projections.json"
    ])
  ).sort((left, right) => {
    const priorityDifference = previewFilePriority(left) - previewFilePriority(right);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return left.localeCompare(right);
  });
}

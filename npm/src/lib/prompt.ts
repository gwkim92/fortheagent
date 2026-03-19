import { createInterface } from "node:readline/promises";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import { buildInstalledProfiles, type Manifest } from "./manifest.js";
import { writeBrandBanner } from "./chrome.js";
import { profileRegistry, validateProfileRegistryTemplates } from "./profile-registry.js";
import {
  buildGeneratedFilePreview as buildGeneratedFilePreviewShared,
  defaultPracticeProfiles,
  formatOptionValue as formatOptionValueShared,
  getOptionCopy as getOptionCopyShared,
  inferDefaultsFromScan as inferDefaultsFromScanShared,
  normalizeAnswers as normalizeAnswersShared,
  resolveMultiOptionInput as resolveMultiOptionInputShared,
  resolveOptionInput as resolveOptionInputShared,
  resolvePromptOptions as resolvePromptOptionsShared
} from "./init-session.js";
import type { RepositoryScan } from "./repo-scan.js";
import type { SelectionInput } from "./selection.js";
import { listTemplateFiles, toRepositoryPath } from "./templates.js";

type PromptStreams = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
};

export type PromptAnswerSet = Partial<SelectionInput> & {
  confirm?: boolean;
};

type PromptAnswerInput = PromptAnswerSet | PromptAnswerSet[];
type PromptDefaults = Partial<SelectionInput>;
type SingleChoiceLabel =
  | "projectPhase"
  | "frontend"
  | "backend"
  | "systemType"
  | "architectureStyle";
type MultiChoiceLabel = "constraints" | "qualityProfiles" | "practiceProfiles";
type PromptLabel = SingleChoiceLabel | MultiChoiceLabel;
type PromptOptionSet = {
  projectPhase: string[];
  frontend: string[];
  backend: string[];
  systemType: string[];
  architectureStyle: string[];
  constraints: string[];
  qualityProfiles: string[];
  practiceProfiles: string[];
};
type PromptStep =
  | { kind: "single"; label: SingleChoiceLabel }
  | { kind: "multi"; label: MultiChoiceLabel }
  | {
      kind: "text";
      label:
        | "currentPainPoints"
        | "stabilityConstraints"
        | "primaryProduct"
        | "targetUsers"
        | "coreEntities"
        | "criticalRisks"
        | "deliveryPriorities";
    };
type PromptConfig = {
  answerSet?: PromptAnswerInput;
  streams?: PromptStreams;
  defaults?: PromptDefaults;
  scan?: RepositoryScan;
};
type OptionCopy = {
  label: string;
  description?: string;
};
type TextPromptLabel =
  | "currentPainPoints"
  | "stabilityConstraints"
  | "primaryProduct"
  | "targetUsers"
  | "coreEntities"
  | "criticalRisks"
  | "deliveryPriorities";

const promptTitles = {
  projectPhase: "Project Phase",
  frontend: "Frontend",
  backend: "Backend",
  systemType: "Project Type",
  architectureStyle: "Codebase Structure",
  constraints: "Additional Requirements",
  qualityProfiles: "Automation and Quality",
  practiceProfiles: "Engineering Practices"
} as const;

const textPromptTitles: Record<TextPromptLabel, string> = {
  currentPainPoints: "Current Pain Points",
  stabilityConstraints: "Stability Constraints",
  primaryProduct: "Primary Product",
  targetUsers: "Target Users",
  coreEntities: "Core Entities",
  criticalRisks: "Critical Risks",
  deliveryPriorities: "Delivery Priorities"
};

const stepHints = {
  projectPhase: "Pick whether this foundation is for a new project or an existing repository.",
  frontend: "Pick the main frontend stack.",
  backend: "Pick the main backend or API stack.",
  systemType: "Pick the kind of product this repo supports.",
  architectureStyle: "Pick the main structure you expect to maintain.",
  constraints:
    "Pick any extra conditions this project must account for. Press Enter if none apply.",
  qualityProfiles: "Pick any automation or quality setup to add now.",
  practiceProfiles: "Pick the engineering habits this foundation should actively enforce."
} as const;

const textStepHints: Record<TextPromptLabel, string> = {
  currentPainPoints:
    "List the main problems or debt areas in the current repository as comma-separated values.",
  stabilityConstraints:
    "List what must remain stable during refactoring or adoption as comma-separated values.",
  primaryProduct: "Describe the main product or use case in one sentence.",
  targetUsers: "List the main user groups or operators as comma-separated values.",
  coreEntities: "List the core domain entities or nouns as comma-separated values.",
  criticalRisks: "List the main technical or business risks as comma-separated values.",
  deliveryPriorities: "List the delivery priorities that should shape the first design pass."
};

const optionCopy: Record<PromptLabel, Record<string, OptionCopy>> = {
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

const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  dim: "\u001b[2m",
  cyan: "\u001b[36m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  red: "\u001b[31m",
  magenta: "\u001b[35m"
} as const;

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getOptionCopy(label: PromptLabel, option: string): OptionCopy {
  return optionCopy[label][option] ?? {
    label: option
  };
}

function formatOptionValue(label: PromptLabel, option: string): string {
  return getOptionCopy(label, option).label;
}

function formatSelection(selection: SelectionInput): string[] {
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

function supportsColor(output: NodeJS.WritableStream): boolean {
  return Boolean((output as NodeJS.WritableStream & { isTTY?: boolean }).isTTY);
}

function style(
  output: NodeJS.WritableStream,
  text: string,
  ...codes: string[]
): string {
  if (!supportsColor(output) || codes.length === 0) {
    return text;
  }

  return `${codes.join("")}${text}${ansi.reset}`;
}

function writeBanner(output: NodeJS.WritableStream): void {
  writeBrandBanner(output, "guided setup", [
    "Bootstrap docs, rules, skills, and repo guardrails in one guided pass.",
    "Only implemented profiles are shown. Validation runs automatically at the end."
  ]);
}

function writeScanHighlights(
  output: NodeJS.WritableStream,
  scan: RepositoryScan | undefined
): void {
  if (!scan) {
    return;
  }

  const highlights = [
    `package manager: ${scan.packageManager}`,
    `workspace: ${scan.workspaceLayout}`,
    `recommended phase: ${formatOptionValue("projectPhase", scan.phaseRecommendation)}`,
    ...(scan.packageName ? [`package: ${scan.packageName}`] : []),
    ...(Object.keys(scan.scripts).length > 0
      ? [`scripts: ${Object.keys(scan.scripts).sort().join(", ")}`]
      : []),
    ...(scan.testHints.length > 0 ? [`tests: ${scan.testHints.join("; ")}`] : [])
  ];

  if (highlights.length === 0) {
    return;
  }

  writeLine(output);
  writeLine(output, style(output, " Detected repository signals", ansi.bold, ansi.yellow));
  for (const highlight of highlights) {
    writeLine(output, style(output, `  - ${highlight}`, ansi.dim));
  }

  if (scan.phaseRecommendationReasons.length > 0) {
    writeLine(
      output,
      style(
        output,
        `  - recommendation reasons: ${scan.phaseRecommendationReasons.join("; ")}`,
        ansi.dim
      )
    );
  }
}

function writeStepHeader(
  output: NodeJS.WritableStream,
  label: SingleChoiceLabel | MultiChoiceLabel | TextPromptLabel,
  step: number,
  totalSteps: number
): void {
  writeLine(output);
  writeLine(
    output,
    style(
      output,
      `>> [${step}/${totalSteps}] ${label in promptTitles ? promptTitles[label as PromptLabel] : textPromptTitles[label as TextPromptLabel]}`,
      ansi.bold,
      ansi.cyan
    )
  );
  writeLine(
    output,
    style(
      output,
      label in stepHints ? stepHints[label as PromptLabel] : textStepHints[label as TextPromptLabel],
      ansi.dim
    )
  );
}

function buildPromptSteps(options: PromptOptionSet): PromptStep[] {
  return buildPromptStepsForPhase(options, "greenfield");
}

function buildPromptStepsForPhase(
  options: PromptOptionSet,
  projectPhase: "greenfield" | "existing"
): PromptStep[] {
  const steps: PromptStep[] = [{ kind: "single", label: "projectPhase" }];

  for (const label of ["frontend", "backend", "systemType", "architectureStyle"] as const) {
    if (options[label].length > 1) {
      steps.push({ kind: "single", label });
    }
  }

  for (const label of ["constraints", "qualityProfiles", "practiceProfiles"] as const) {
    if (options[label].length > 0) {
      steps.push({ kind: "multi", label });
    }
  }

  steps.push(
    { kind: "text", label: "primaryProduct" },
    { kind: "text", label: "targetUsers" },
    { kind: "text", label: "coreEntities" },
    { kind: "text", label: "criticalRisks" },
    { kind: "text", label: "deliveryPriorities" }
  );

  if (projectPhase === "existing") {
    steps.push(
      { kind: "text", label: "currentPainPoints" },
      { kind: "text", label: "stabilityConstraints" }
    );
  }

  return steps;
}

function collectAutoSelections(
  options: PromptOptionSet,
  defaults: PromptDefaults = {}
): Array<{ label: SingleChoiceLabel; value: string }> {
  const autoSelections: Array<{ label: SingleChoiceLabel; value: string }> = [];

  for (const label of ["frontend", "backend", "systemType", "architectureStyle"] as const) {
    if (options[label].length === 1) {
      autoSelections.push({
        label,
        value: defaults[label] && options[label].includes(defaults[label] as string)
          ? (defaults[label] as string)
          : options[label][0] as string
      });
    }
  }

  return autoSelections;
}

function pickFirstMatchingOption(
  hints: string[],
  options: readonly string[]
): string | undefined {
  return hints.find((hint) => options.includes(hint));
}

function writeAutoSelections(
  output: NodeJS.WritableStream,
  autoSelections: Array<{ label: SingleChoiceLabel; value: string }>
): void {
  if (autoSelections.length === 0) {
    return;
  }

  writeLine(output);
  writeLine(output, style(output, " Auto-applied", ansi.bold, ansi.yellow));

  for (const autoSelection of autoSelections) {
    writeLine(
      output,
      style(
        output,
        `  - ${promptTitles[autoSelection.label]}: ${formatOptionValue(
          autoSelection.label,
          autoSelection.value
        )}`,
        ansi.dim
      )
    );
  }
}

async function collectImplementedOptions(
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

async function resolvePromptOptions(): Promise<PromptOptionSet> {
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

function inferDefaultsFromScan(
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

function formatNumberedOption(option: string, index: number, defaultSelected: boolean): string {
  const suffix = defaultSelected ? " (default)" : "";
  return `  ${index + 1}. ${option}${suffix}`;
}

function writeOptionLine(
  output: NodeJS.WritableStream,
  label: PromptLabel,
  option: string,
  index: number,
  defaultSelected: boolean
): void {
  const copy = getOptionCopy(label, option);

  writeLine(output, formatNumberedOption(copy.label, index, defaultSelected));

  if (copy.description) {
    writeLine(output, style(output, `     ${copy.description}`, ansi.dim));
  }
}

function resolveOptionInput(
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

function resolveMultiOptionInput(
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

function normalizeAnswers(
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
      merged.practiceProfiles ?? ["ddd-core", "tdd-first", "strict-verification"],
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

async function askSingleChoice(
  label: SingleChoiceLabel,
  options: readonly string[],
  question: (query: string) => Promise<string>,
  output: NodeJS.WritableStream,
  defaultValue: string | undefined,
  step: number,
  totalSteps: number
): Promise<string> {
  writeStepHeader(output, label, step, totalSteps);

  if (options.length === 1) {
    writeLine(
      output,
      style(
        output,
        `  only available right now: ${formatOptionValue(label, options[0] as string)}`,
        ansi.yellow,
        ansi.bold
      )
    );
    return options[0] as string;
  }

  while (true) {
    for (const [index, option] of options.entries()) {
      writeOptionLine(output, label, option, index, option === defaultValue);
    }
    const defaultIndex = defaultValue ? options.indexOf(defaultValue) + 1 : 0;
    const promptSuffix = defaultIndex > 0 ? ` [default ${defaultIndex}]` : "";
    const answer = (await question(`Select one${promptSuffix}: `)).trim();

    if (!answer && defaultValue) {
      return defaultValue;
    }

    const resolved = resolveOptionInput(answer, options);

    if (resolved) {
      return resolved;
    }

    writeLine(output, style(output, `Expected one number from 1 to ${options.length}.`, ansi.red));
  }
}

async function askMultiSelect(
  label: MultiChoiceLabel,
  options: readonly string[],
  question: (query: string) => Promise<string>,
  output: NodeJS.WritableStream,
  defaultValues: string[] = [],
  step: number,
  totalSteps: number
): Promise<string[]> {
  writeStepHeader(output, label, step, totalSteps);

  if (options.length === 0) {
    writeLine(output, style(output, "  no implemented options for this step", ansi.dim));
    return [];
  }

  while (true) {
    for (const [index, option] of options.entries()) {
      writeOptionLine(output, label, option, index, defaultValues.includes(option));
    }
    const defaultIndexes = defaultValues
      .map((value) => options.indexOf(value) + 1)
      .filter((index) => index > 0);
    const promptSuffix =
      defaultIndexes.length > 0 ? ` [default ${defaultIndexes.join(",")}]` : "";
    writeLine(
      output,
      style(output, "  Enter comma-separated numbers, or press Enter if none apply.", ansi.dim)
    );
    const answer = (await question(`Select any${promptSuffix}: `)).trim();
    const resolved = resolveMultiOptionInput(answer, options);

    try {
      return normalizeMultiSelect(
        label,
        resolved === null ? ["__invalid__"] : answer ? resolved : defaultValues,
        options
      );
    } catch {
      writeLine(
        output,
        style(output, `Expected zero or more numbers from 1 to ${options.length}.`, ansi.red)
      );
    }
  }
}

async function askTextInput(
  label:
    | "currentPainPoints"
    | "stabilityConstraints"
    | "primaryProduct"
    | "targetUsers"
    | "coreEntities"
    | "criticalRisks"
    | "deliveryPriorities",
  question: (query: string) => Promise<string>,
  output: NodeJS.WritableStream,
  defaultValue: string,
  step: number,
  totalSteps: number
): Promise<string> {
  writeStepHeader(output, label, step, totalSteps);
  const promptSuffix = defaultValue ? ` [default: ${defaultValue}]` : "";
  const answer = (await question(`Enter text${promptSuffix}: `)).trim();
  return answer || defaultValue;
}

async function askTextList(
  label:
    | "targetUsers"
    | "coreEntities"
    | "criticalRisks"
    | "deliveryPriorities"
    | "currentPainPoints"
    | "stabilityConstraints",
  question: (query: string) => Promise<string>,
  output: NodeJS.WritableStream,
  defaultValues: string[],
  step: number,
  totalSteps: number
): Promise<string[]> {
  writeStepHeader(output, label, step, totalSteps);
  const defaultValue = defaultValues.join(", ");
  const promptSuffix = defaultValue ? ` [default: ${defaultValue}]` : "";
  writeLine(output, style(output, "  Use comma-separated values.", ansi.dim));
  const answer = (await question(`Enter values${promptSuffix}: `)).trim();
  return unique((answer || defaultValue).split(","));
}

async function askConfirmation(
  question: (query: string) => Promise<string>,
  output: NodeJS.WritableStream
): Promise<boolean> {
  while (true) {
    writeLine(output);
    writeLine(output, style(output, "Review and confirm", ansi.bold, ansi.green));
    writeLine(output, "  1. yes");
    writeLine(output, "  2. no");
    const answer = (await question("Confirm selection: ")).trim().toLowerCase();

    if (answer === "1" || answer === "y" || answer === "yes") {
      return true;
    }

    if (answer === "2" || answer === "n" || answer === "no") {
      return false;
    }

    writeLine(output, style(output, "Expected: 1, 2, yes, or no", ansi.red));
  }
}

function normalizeAnswerInput(answerInput: PromptAnswerInput): PromptAnswerSet[] {
  return Array.isArray(answerInput) ? answerInput : [answerInput];
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

async function buildGeneratedFilePreview(selection: SelectionInput): Promise<string[]> {
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
  ).sort();
}

function writeGeneratedFilePreview(output: NodeJS.WritableStream, files: string[]): void {
  writeLine(output);
  writeLine(output, style(output, "Files to Create or Update", ansi.bold, ansi.green));

  for (const file of files) {
    writeLine(output, `  - ${file}`);
  }
}

export function createSession(config: PromptConfig = {}) {
  return {
    async run(): Promise<SelectionInput> {
      const promptOptions = await resolvePromptOptionsShared();
      const defaults = {
        ...inferDefaultsFromScanShared(config.scan, promptOptions),
        ...(config.defaults ?? {})
      };

      if (config.answerSet) {
        const attempts = normalizeAnswerInput(config.answerSet);

        for (const attempt of attempts) {
          const { confirm = true, ...answers } = attempt;
          const normalized = normalizeAnswersShared(answers, promptOptions, defaults);

          if (confirm) {
            return normalized;
          }
        }

        throw new Error("No confirmed answer set provided");
      }

      const output = config.streams?.output ?? defaultOutput;
      const rl = createInterface({
        input: config.streams?.input ?? defaultInput,
        output
      });

      try {
        writeBanner(output);
        writeScanHighlights(output, config.scan);
        let promptDefaults = defaults;

        while (true) {
          writeAutoSelections(output, collectAutoSelections(promptOptions, promptDefaults));
          const phaseDefault =
            (promptDefaults.projectPhase as "greenfield" | "existing" | undefined) ??
            "greenfield";
          const projectPhase = (await askSingleChoice(
            "projectPhase",
            promptOptions.projectPhase,
            (query) => rl.question(query),
            output,
            phaseDefault,
            1,
            buildPromptStepsForPhase(promptOptions, phaseDefault).length
          )) as "greenfield" | "existing";
          const promptSteps = buildPromptStepsForPhase(promptOptions, projectPhase);
          let stepIndex = 1;

          const frontend =
            promptOptions.frontend.length > 1
              ? await askSingleChoice(
                  "frontend",
                  promptOptions.frontend,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.frontend ?? undefined,
                  ++stepIndex,
                  promptSteps.length
                )
              : (promptDefaults.frontend ?? promptOptions.frontend[0]) as string;
          const backend =
            promptOptions.backend.length > 1
              ? await askSingleChoice(
                  "backend",
                  promptOptions.backend,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.backend ?? undefined,
                  ++stepIndex,
                  promptSteps.length
                )
              : (promptDefaults.backend ?? promptOptions.backend[0]) as string;
          const systemType =
            promptOptions.systemType.length > 1
              ? await askSingleChoice(
                  "systemType",
                  promptOptions.systemType,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.systemType ?? undefined,
                  ++stepIndex,
                  promptSteps.length
                )
              : (promptDefaults.systemType ?? promptOptions.systemType[0]) as string;
          const architectureStyle =
            promptOptions.architectureStyle.length > 1
              ? await askSingleChoice(
                  "architectureStyle",
                  promptOptions.architectureStyle,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.architectureStyle ?? undefined,
                  ++stepIndex,
                  promptSteps.length
                )
              : (promptDefaults.architectureStyle ?? promptOptions.architectureStyle[0]) as string;
          const constraints =
            promptOptions.constraints.length > 0
              ? await askMultiSelect(
                  "constraints",
                  promptOptions.constraints,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.constraints ?? [],
                  ++stepIndex,
                  promptSteps.length
                )
              : [];
          const qualityProfiles =
            promptOptions.qualityProfiles.length > 0
              ? await askMultiSelect(
                  "qualityProfiles",
                  promptOptions.qualityProfiles,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.qualityProfiles ?? [],
                  ++stepIndex,
                  promptSteps.length
                )
              : [];
          const practiceProfiles =
            promptOptions.practiceProfiles.length > 0
              ? await askMultiSelect(
                  "practiceProfiles",
                  promptOptions.practiceProfiles,
                  (query) => rl.question(query),
                  output,
                  promptDefaults.practiceProfiles ?? [
                    ...defaultPracticeProfiles
                  ],
                  ++stepIndex,
                  promptSteps.length
                )
              : [];
          const primaryProduct = await askTextInput(
            "primaryProduct",
            (query) => rl.question(query),
            output,
            promptDefaults.primaryProduct ?? "",
            ++stepIndex,
            promptSteps.length
          );
          const targetUsers = await askTextList(
            "targetUsers",
            (query) => rl.question(query),
            output,
            promptDefaults.targetUsers ?? [],
            ++stepIndex,
            promptSteps.length
          );
          const coreEntities = await askTextList(
            "coreEntities",
            (query) => rl.question(query),
            output,
            promptDefaults.coreEntities ?? [],
            ++stepIndex,
            promptSteps.length
          );
          const criticalRisks = await askTextList(
            "criticalRisks",
            (query) => rl.question(query),
            output,
            promptDefaults.criticalRisks ?? [],
            ++stepIndex,
            promptSteps.length
          );
          const deliveryPriorities = await askTextList(
            "deliveryPriorities",
            (query) => rl.question(query),
            output,
            promptDefaults.deliveryPriorities ?? [],
            ++stepIndex,
            promptSteps.length
          );
          const currentPainPoints =
            projectPhase === "existing"
              ? await askTextList(
                  "currentPainPoints",
                  (query) => rl.question(query),
                  output,
                  promptDefaults.currentPainPoints ?? [],
                  ++stepIndex,
                  promptSteps.length
                )
              : [];
          const stabilityConstraints =
            projectPhase === "existing"
              ? await askTextList(
                  "stabilityConstraints",
                  (query) => rl.question(query),
                  output,
                  promptDefaults.stabilityConstraints ?? [],
                  ++stepIndex,
                  promptSteps.length
                )
              : [];

          const selection = normalizeAnswersShared(
            {
              projectPhase,
              frontend,
              backend,
              systemType,
              architectureStyle,
              constraints,
              qualityProfiles,
              practiceProfiles,
              primaryProduct,
              targetUsers,
              coreEntities,
              criticalRisks,
              deliveryPriorities,
              currentPainPoints,
              stabilityConstraints
            },
            promptOptions,
            promptDefaults
          );

          writeLine(output);
          writeLine(output, style(output, "Selection Summary", ansi.bold, ansi.green));
          for (const line of formatSelection(selection)) {
            writeLine(output, line);
          }
          writeGeneratedFilePreview(output, await buildGeneratedFilePreviewShared(selection));
          writeLine(output);

          if (await askConfirmation((query) => rl.question(query), output)) {
            return selection;
          }

          writeLine(output, style(output, "Restarting setup with your previous answers.", ansi.dim));
          promptDefaults = selection;
        }
      } finally {
        rl.close();
      }
    }
  };
}

export const promptTestInternals = {
  buildGeneratedFilePreview: buildGeneratedFilePreviewShared,
  buildPromptSteps,
  buildPromptStepsForPhase,
  collectAutoSelections,
  formatNumberedOption,
  formatOptionValue: formatOptionValueShared,
  getOptionCopy: getOptionCopyShared,
  inferDefaultsFromScan: inferDefaultsFromScanShared,
  resolveOptionInput: resolveOptionInputShared,
  resolveMultiOptionInput: resolveMultiOptionInputShared,
  resolvePromptOptions: resolvePromptOptionsShared
};

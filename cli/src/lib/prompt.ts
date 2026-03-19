import { profileRegistry } from "./profile-registry.js";
import type { SelectionInput } from "./selection.js";
import {
  promptForChecklistSelection,
  promptForMenuSelection,
  promptForText,
  type MenuOption
} from "./terminal.js";
import { renderFieldPrompt, renderPanel } from "../app/chrome.js";

type PromptStreams = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
};

export type PromptAnswerSet = Partial<SelectionInput> & {
  confirm?: boolean;
};

type PromptAnswerInput = PromptAnswerSet | PromptAnswerSet[];
type PromptDefaults = Partial<SelectionInput>;
type PromptConfig = {
  answerSet?: PromptAnswerInput;
  streams?: PromptStreams;
  defaults?: PromptDefaults;
};

type SingleChoiceLabel =
  | "projectPhase"
  | "frontend"
  | "backend"
  | "systemType"
  | "architectureStyle";

type MultiChoiceLabel = "constraints" | "qualityProfiles" | "practiceProfiles";
type TextLabel =
  | "primaryProduct"
  | "targetUsers"
  | "coreEntities"
  | "criticalRisks"
  | "deliveryPriorities"
  | "currentPainPoints"
  | "stabilityConstraints";

const titles: Record<SingleChoiceLabel | MultiChoiceLabel | TextLabel, string> = {
  projectPhase: "Project phase",
  frontend: "Frontend stack",
  backend: "Backend stack",
  systemType: "Project type",
  architectureStyle: "Architecture style",
  constraints: "Important concerns",
  qualityProfiles: "Automation and quality",
  practiceProfiles: "Engineering practices",
  primaryProduct: "Primary product",
  targetUsers: "Target users",
  coreEntities: "Core entities",
  criticalRisks: "Critical risks",
  deliveryPriorities: "Delivery priorities",
  currentPainPoints: "Current pain points",
  stabilityConstraints: "Stability constraints"
};

const hints: Record<SingleChoiceLabel | MultiChoiceLabel | TextLabel, string> = {
  projectPhase: "Choose whether this is a new project or an existing repository.",
  frontend: "Choose the main frontend stack for this repository.",
  backend: "Choose the main backend or API stack for this repository.",
  systemType: "Choose the kind of product or system this repository supports.",
  architectureStyle: "Choose the main codebase structure you expect to maintain.",
  constraints: "Pick any constraints or conditions that should shape the docs foundation.",
  qualityProfiles: "Pick any automation or quality setup to install now.",
  practiceProfiles: "Pick the engineering habits the generated docs should actively enforce.",
  primaryProduct: "Describe the main product or use case in one sentence.",
  targetUsers: "Comma-separated user groups or operators.",
  coreEntities: "Comma-separated core domain nouns or entities.",
  criticalRisks: "Comma-separated technical or business risks.",
  deliveryPriorities: "Comma-separated priorities for the first design pass.",
  currentPainPoints: "Comma-separated current problems or debt areas in the repository.",
  stabilityConstraints: "Comma-separated things that must stay stable during migration."
};

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function toList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return unique(value);
  }

  if (!value) {
    return [];
  }

  return unique(value.split(","));
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

function ensureAllowedMulti(
  field: MultiChoiceLabel,
  values: string[],
  options: readonly string[]
): string[] {
  for (const value of values) {
    if (!options.includes(value)) {
      throw new Error(`Invalid ${field} value: ${value}`);
    }
  }

  return unique(values);
}

function normalizeAnswers(
  answerSet: Partial<SelectionInput>,
  defaults: PromptDefaults = {}
): SelectionInput {
  const merged = {
    ...defaults,
    ...answerSet
  };

  const projectPhase = ensureAllowed(
    "projectPhase",
    merged.projectPhase ?? "greenfield",
    profileRegistry.projectPhase
  ) as SelectionInput["projectPhase"];

  return {
    projectPhase,
    frontend: ensureAllowed(
      "frontend",
      merged.frontend ?? "none",
      profileRegistry.frontend
    ),
    backend: ensureAllowed(
      "backend",
      merged.backend ?? "none",
      profileRegistry.backend
    ),
    systemType: ensureAllowed(
      "systemType",
      merged.systemType ?? "internal-tool",
      profileRegistry.systemType
    ),
    architectureStyle: ensureAllowed(
      "architectureStyle",
      merged.architectureStyle ?? "modular-monolith",
      profileRegistry.architectureStyle
    ),
    constraints: ensureAllowedMulti(
      "constraints",
      merged.constraints ?? [],
      profileRegistry.constraints
    ),
    qualityProfiles: ensureAllowedMulti(
      "qualityProfiles",
      merged.qualityProfiles ?? [],
      profileRegistry.qualityProfiles
    ),
    practiceProfiles: ensureAllowedMulti(
      "practiceProfiles",
      merged.practiceProfiles ?? [],
      profileRegistry.practiceProfiles
    ),
    primaryProduct: (merged.primaryProduct ?? "").trim(),
    targetUsers: toList(merged.targetUsers),
    coreEntities: toList(merged.coreEntities),
    criticalRisks: toList(merged.criticalRisks),
    deliveryPriorities: toList(merged.deliveryPriorities),
    currentPainPoints: projectPhase === "existing" ? toList(merged.currentPainPoints) : [],
    stabilityConstraints:
      projectPhase === "existing" ? toList(merged.stabilityConstraints) : []
  };
}

function formatSelection(selection: SelectionInput): string[] {
  const rows = [
    ["Project phase", selection.projectPhase],
    ["Frontend", selection.frontend ?? "none"],
    ["Backend", selection.backend ?? "none"],
    ["Project type", selection.systemType ?? "none"],
    ["Architecture", selection.architectureStyle ?? "none"],
    ["Constraints", selection.constraints.join(", ") || "none"],
    ["Quality", selection.qualityProfiles.join(", ") || "none"],
    ["Practices", selection.practiceProfiles.join(", ") || "none"],
    ["Primary product", selection.primaryProduct || "unconfirmed"],
    ["Target users", selection.targetUsers.join(", ") || "unconfirmed"],
    ["Core entities", selection.coreEntities.join(", ") || "unconfirmed"],
    ["Critical risks", selection.criticalRisks.join(", ") || "unconfirmed"],
    ["Delivery priorities", selection.deliveryPriorities.join(", ") || "unconfirmed"],
    ...(selection.projectPhase === "existing"
      ? ([
          ["Current pain points", selection.currentPainPoints.join(", ") || "unconfirmed"],
          ["Stability constraints", selection.stabilityConstraints.join(", ") || "unconfirmed"]
        ] as const)
      : [])
  ] as const;

  return rows.map(([label, value]) => `${label}: ${value}`);
}

function normalizeAnswerInput(answerInput: PromptAnswerInput): PromptAnswerSet[] {
  return Array.isArray(answerInput) ? answerInput : [answerInput];
}

function getTotalSteps(projectPhase: SelectionInput["projectPhase"]): number {
  return projectPhase === "existing" ? 15 : 13;
}

async function askSingleChoice(
  label: SingleChoiceLabel,
  options: readonly string[],
  streams: PromptStreams,
  output: NodeJS.WritableStream,
  step: number,
  total: number,
  defaultValue?: string
): Promise<string> {
  writeLine(
    output,
    renderFieldPrompt({
      title: "Project Setup",
      field: titles[label],
      step,
      total,
      hint: defaultValue ? `${hints[label]} Current: ${defaultValue}` : hints[label]
    })
  );

  const menuOptions: MenuOption<string>[] = options.map((option, index) => ({
    label: `[${index + 1}] ${option}${defaultValue === option ? " (default)" : ""}`,
    value: option,
    keywords: [String(index + 1), option]
  }));

  return promptForMenuSelection({
    title: titles[label],
    streams,
    fallbackPrompt: `${titles[label]}: `,
    options: menuOptions
  });
}

async function askMultiChoice(
  label: MultiChoiceLabel,
  options: readonly string[],
  streams: PromptStreams,
  output: NodeJS.WritableStream,
  step: number,
  total: number,
  defaultValues: string[]
): Promise<string[]> {
  writeLine(
    output,
    renderFieldPrompt({
      title: "Project Setup",
      field: titles[label],
      step,
      total,
      hint:
        defaultValues.length > 0
          ? `${hints[label]} Current: ${defaultValues.join(", ")}`
          : hints[label]
    })
  );

  return unique(
    await promptForChecklistSelection({
      title: titles[label],
      streams,
      fallbackPrompt: `${titles[label]} (comma-separated): `,
      initialSelected: defaultValues,
      options: options.map((option, index) => ({
        label: `[${index + 1}] ${option}`,
        value: option,
        keywords: [String(index + 1), option]
      }))
    })
  );
}

async function askTextValue(
  label: TextLabel,
  streams: PromptStreams,
  output: NodeJS.WritableStream,
  step: number,
  total: number,
  defaultValue: string
): Promise<string> {
  writeLine(
    output,
    renderFieldPrompt({
      title: "Project Setup",
      field: titles[label],
      step,
      total,
      hint: defaultValue ? `${hints[label]} Current: ${defaultValue}` : hints[label]
    })
  );

  return (
    await promptForText(`${titles[label]}: `, streams)
  ).trim() || defaultValue;
}

async function askTextList(
  label: TextLabel,
  streams: PromptStreams,
  output: NodeJS.WritableStream,
  step: number,
  total: number,
  defaultValues: string[]
): Promise<string[]> {
  const value = await askTextValue(
    label,
    streams,
    output,
    step,
    total,
    defaultValues.join(", ")
  );
  return toList(value);
}

async function askConfirmation(
  streams: PromptStreams,
  output: NodeJS.WritableStream,
  selection: SelectionInput
): Promise<boolean> {
  writeLine(
    output,
    renderPanel({
      title: "Project setup summary",
      subtitle: "Review these answers before forTheAgent writes the docs",
      lines: formatSelection(selection).map((line) => ({ text: line }))
    })
  );

  return promptForMenuSelection({
    title: "Looks right?",
    streams,
    fallbackPrompt: "Does this look right? [y/n]: ",
    options: [
      {
        label: "[1] Confirm and write docs",
        value: true,
        keywords: ["1", "y", "yes", "confirm"]
      },
      {
        label: "[2] Edit answers",
        value: false,
        keywords: ["2", "n", "no", "edit"]
      }
    ]
  });
}

export function createSession(config: PromptConfig = {}) {
  return {
    async run(): Promise<SelectionInput> {
      const defaults = config.defaults ?? {};

      if (config.answerSet) {
        const attempts = normalizeAnswerInput(config.answerSet);

        for (const attempt of attempts) {
          const { confirm = true, ...answers } = attempt;
          const normalized = normalizeAnswers(answers, defaults);

          if (confirm) {
            return normalized;
          }
        }

        throw new Error("No confirmed answer set provided");
      }

      const output = config.streams?.output ?? process.stdout;
      let promptDefaults = defaults;

      while (true) {
        const projectPhase = (await askSingleChoice(
          "projectPhase",
          profileRegistry.projectPhase,
          config.streams ?? {},
          output,
          1,
          getTotalSteps((promptDefaults.projectPhase ?? "greenfield") as SelectionInput["projectPhase"]),
          promptDefaults.projectPhase ?? undefined
        )) as SelectionInput["projectPhase"];
        const total = getTotalSteps(projectPhase);

        const frontend = await askSingleChoice(
          "frontend",
          profileRegistry.frontend,
          config.streams ?? {},
          output,
          2,
          total,
          promptDefaults.frontend ?? undefined
        );
        const backend = await askSingleChoice(
          "backend",
          profileRegistry.backend,
          config.streams ?? {},
          output,
          3,
          total,
          promptDefaults.backend ?? undefined
        );
        const systemType = await askSingleChoice(
          "systemType",
          profileRegistry.systemType,
          config.streams ?? {},
          output,
          4,
          total,
          promptDefaults.systemType ?? undefined
        );
        const architectureStyle = await askSingleChoice(
          "architectureStyle",
          profileRegistry.architectureStyle,
          config.streams ?? {},
          output,
          5,
          total,
          promptDefaults.architectureStyle ?? undefined
        );
        const constraints = await askMultiChoice(
          "constraints",
          profileRegistry.constraints,
          config.streams ?? {},
          output,
          6,
          total,
          promptDefaults.constraints ?? []
        );
        const qualityProfiles = await askMultiChoice(
          "qualityProfiles",
          profileRegistry.qualityProfiles,
          config.streams ?? {},
          output,
          7,
          total,
          promptDefaults.qualityProfiles ?? []
        );
        const practiceProfiles = await askMultiChoice(
          "practiceProfiles",
          profileRegistry.practiceProfiles,
          config.streams ?? {},
          output,
          8,
          total,
          promptDefaults.practiceProfiles ?? []
        );
        const primaryProduct = await askTextValue(
          "primaryProduct",
          config.streams ?? {},
          output,
          9,
          total,
          promptDefaults.primaryProduct ?? ""
        );
        const targetUsers = await askTextList(
          "targetUsers",
          config.streams ?? {},
          output,
          10,
          total,
          promptDefaults.targetUsers ?? []
        );
        const coreEntities = await askTextList(
          "coreEntities",
          config.streams ?? {},
          output,
          11,
          total,
          promptDefaults.coreEntities ?? []
        );
        const criticalRisks = await askTextList(
          "criticalRisks",
          config.streams ?? {},
          output,
          12,
          total,
          promptDefaults.criticalRisks ?? []
        );
        const deliveryPriorities = await askTextList(
          "deliveryPriorities",
          config.streams ?? {},
          output,
          13,
          total,
          promptDefaults.deliveryPriorities ?? []
        );

        let currentPainPoints: string[] = [];
        let stabilityConstraints: string[] = [];

        if (projectPhase === "existing") {
          currentPainPoints = await askTextList(
            "currentPainPoints",
            config.streams ?? {},
            output,
            14,
            total,
            promptDefaults.currentPainPoints ?? []
          );
          stabilityConstraints = await askTextList(
            "stabilityConstraints",
            config.streams ?? {},
            output,
            15,
            total,
            promptDefaults.stabilityConstraints ?? []
          );
        }

        const selection = normalizeAnswers(
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
          promptDefaults
        );

        writeLine(output);

        if (await askConfirmation(config.streams ?? {}, output, selection)) {
          return selection;
        }

        writeLine(
          output,
          renderPanel({
            title: "Update your project answers",
            subtitle: "Previous answers stay selected so you only change what moved",
            lines: [{ text: "forTheAgent kept the last answers as the new defaults." }]
          })
        );
        promptDefaults = selection;
      }
    }
  };
}

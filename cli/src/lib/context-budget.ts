export type ContextClass =
  | "bootstrap"
  | "indexed"
  | "scoped"
  | "skill-metadata"
  | "skill-body"
  | "dynamic";

export type ContextBudgetEntry = {
  filePath: string;
  contextClass: ContextClass;
  maxLines: number | null;
};

export type ContextBudgetManifest = {
  version: string;
  entries: ContextBudgetEntry[];
};

function classifyContextFile(filePath: string): ContextClass {
  if (filePath === "AGENTS.md" || filePath === "GEMINI.md") {
    return "bootstrap";
  }

  if (filePath.startsWith(".agent-foundation/")) {
    return "dynamic";
  }

  if (filePath === "docs/skills/index.md") {
    return "skill-metadata";
  }

  if (filePath.startsWith(".agents/skills/")) {
    return "skill-body";
  }

  if (
    filePath.startsWith("docs/architecture/") ||
    filePath.startsWith("docs/system/")
  ) {
    return "scoped";
  }

  return "indexed";
}

function getContextBudget(filePath: string): number | null {
  if (
    filePath === ".agent-foundation/manifest.json" ||
    filePath === ".agent-foundation/profile-registry.json" ||
    filePath === ".agent-foundation/context-budget.json" ||
    filePath === ".agent-foundation/provider-projections.json"
  ) {
    return null;
  }

  if (filePath === "AGENTS.md" || filePath === "GEMINI.md") {
    return 120;
  }

  if (filePath === "docs/skills/index.md") {
    return 180;
  }

  if (filePath.startsWith(".agents/skills/")) {
    return 150;
  }

  if (filePath.startsWith("docs/")) {
    return 220;
  }

  return null;
}

export function buildContextBudgetManifest(
  filePaths: Iterable<string>,
  version = "0.1.0"
): ContextBudgetManifest {
  return {
    version,
    entries: [...new Set(filePaths)]
      .sort()
      .map((filePath) => ({
        filePath,
        contextClass: classifyContextFile(filePath),
        maxLines: getContextBudget(filePath)
      }))
  };
}

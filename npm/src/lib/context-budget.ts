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

const ROOT_ENTRY_BUDGET = 120;
const SUBTREE_ENTRY_BUDGET = 40;
const INDEX_BUDGET = 120;
const RULE_BUDGET = 200;
const SKILL_GUIDE_BUDGET = 180;
const SKILL_BODY_BUDGET = 150;
const HANDOFF_BUDGET = 180;
const ADR_AND_WORK_BUDGET = 140;
const DEEP_DOC_BUDGET = 220;
const HOOK_BUDGET = 120;

export function classifyContextFile(filePath: string): ContextClass {
  if (
    filePath === "AGENTS.md" ||
    filePath === "CLAUDE.md" ||
    filePath === "GEMINI.md"
  ) {
    return "bootstrap";
  }

  if (
    filePath === ".agent-foundation/handoff/design-ready.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath === "docs/agents/repo-facts.md" ||
    filePath.startsWith(".agent-foundation/")
  ) {
    return "dynamic";
  }

  if (
    filePath === "docs/index.md" ||
    filePath === "docs/agents/context-map.md" ||
    filePath === "docs/agents/design-handoff.md" ||
    filePath === "docs/product/index.md" ||
    filePath === "docs/engineering/index.md" ||
    filePath === "docs/rules/index.md"
  ) {
    return "indexed";
  }

  if (filePath === "docs/skills/index.md") {
    return "skill-metadata";
  }

  if (filePath.startsWith("docs/skills/")) {
    return "skill-metadata";
  }

  if (filePath.startsWith(".agents/skills/")) {
    return "skill-body";
  }

  if (
    filePath.startsWith("docs/architecture/") ||
    filePath.startsWith("docs/product/constraints/") ||
    filePath.startsWith("docs/system/") ||
    filePath.startsWith("docs/practices/") ||
    filePath === "docs/product/problem-and-users.md" ||
    filePath === "docs/product/domain-glossary.md" ||
    filePath === "docs/product/constraints.md"
  ) {
    return "scoped";
  }

  return "indexed";
}

export function getContextBudget(filePath: string): number | null {
  if (
    filePath === ".agent-foundation/manifest.json" ||
    filePath === ".agent-foundation/profile-registry.json" ||
    filePath === ".agent-foundation/context-budget.json" ||
    filePath === ".agent-foundation/provider-projections.json"
  ) {
    return null;
  }

  if (
    filePath === "AGENTS.md" ||
    filePath === "CLAUDE.md" ||
    filePath === "GEMINI.md"
  ) {
    return ROOT_ENTRY_BUDGET;
  }

  if (
    (filePath.endsWith("/AGENTS.md") ||
      filePath.endsWith("/CLAUDE.md") ||
      filePath.endsWith("/GEMINI.md")) &&
    !filePath.startsWith(".")
  ) {
    return SUBTREE_ENTRY_BUDGET;
  }

  if (
    filePath === "docs/index.md" ||
    filePath === "docs/agents/context-map.md" ||
    filePath === "docs/product/index.md" ||
    filePath === "docs/engineering/index.md" ||
    filePath === "docs/operations/index.md" ||
    filePath === "docs/decisions/index.md" ||
    filePath === "docs/work/index.md" ||
    filePath === "docs/rules/index.md"
  ) {
    return INDEX_BUDGET;
  }

  if (
    filePath === ".agent-foundation/handoff/design-ready.md" ||
    filePath === ".agent-foundation/handoffs/current.md"
  ) {
    return HANDOFF_BUDGET;
  }

  if (filePath.startsWith("docs/rules/")) {
    return RULE_BUDGET;
  }

  if (filePath.startsWith(".claude/rules/") || filePath.startsWith(".cursor/rules/")) {
    return HOOK_BUDGET;
  }

  if (filePath === "docs/skills/index.md" || filePath.startsWith("docs/skills/")) {
    return SKILL_GUIDE_BUDGET;
  }

  if (filePath.startsWith(".agents/skills/")) {
    return SKILL_BODY_BUDGET;
  }

  if (
    filePath.startsWith("docs/work/") ||
    filePath.startsWith("docs/decisions/ADR-")
  ) {
    return ADR_AND_WORK_BUDGET;
  }

  if (filePath.startsWith("docs/")) {
    return DEEP_DOC_BUDGET;
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

export function countLines(content: string): number {
  if (!content) {
    return 0;
  }

  const normalized = content.replace(/^(---\n[\s\S]*?\n---\n+)/, "").replace(/\n$/, "");

  if (!normalized) {
    return 0;
  }

  return normalized.split("\n").length;
}

export type Ownership = "managed" | "merge-managed" | "user-owned";

export function classifyFile(filePath: string): Ownership {
  const isSubtreeAdapter =
    (filePath.endsWith("/AGENTS.md") ||
      filePath.endsWith("/CLAUDE.md") ||
      filePath.endsWith("/GEMINI.md")) &&
    !["AGENTS.md", "CLAUDE.md", "GEMINI.md"].includes(filePath);

  if (
    filePath === ".agent-foundation/manifest.json" ||
    filePath === ".agent-foundation/profile-registry.json" ||
    filePath === ".agent-foundation/context-budget.json" ||
    filePath === ".agent-foundation/provider-projections.json" ||
    filePath === ".agent-foundation/doc-index.json" ||
    filePath === ".agent-foundation/doc-health.json" ||
    filePath === ".agent-foundation/handoff/design-ready.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath.startsWith(".agent-foundation/handoffs/archive/") ||
    filePath === "docs/decisions/ADR-0001-template.md" ||
    filePath === ".claude/rules/index.md" ||
    filePath === ".claude/rules/architecture.md" ||
    filePath === ".claude/rules/testing.md" ||
    filePath === ".claude/rules/frontend.md" ||
    filePath === ".claude/rules/auth.md" ||
    filePath === ".claude/rules/payments.md" ||
    filePath === ".cursor/rules/architecture.mdc" ||
    filePath === ".cursor/rules/testing.mdc" ||
    filePath === ".cursor/rules/frontend.mdc" ||
    filePath === ".cursor/rules/auth.mdc" ||
    filePath === ".cursor/rules/payments.mdc" ||
    filePath === "docs/agents/repo-facts.md" ||
    filePath.startsWith(".agents/skills/") ||
    filePath === ".github/workflows/ci.yml"
  ) {
    return "managed";
  }

  if (
    filePath === "AGENTS.md" ||
    filePath === "CLAUDE.md" ||
    filePath === "GEMINI.md" ||
    isSubtreeAdapter ||
    filePath === "docs/index.md" ||
    filePath === "docs/agents/context-map.md" ||
    filePath === "docs/agents/design-handoff.md" ||
    filePath === "docs/agents/docs-contract.md" ||
    filePath === "docs/product/index.md" ||
    filePath === "docs/product/problem-and-users.md" ||
    filePath === "docs/product/domain-glossary.md" ||
    filePath === "docs/product/constraints.md" ||
    filePath.startsWith("docs/product/constraints/") ||
    filePath === "docs/architecture/overview.md" ||
    filePath === "docs/architecture/current-state.md" ||
    filePath === "docs/architecture/refactor-target.md" ||
    filePath === "docs/architecture/frontend.md" ||
    filePath === "docs/architecture/backend.md" ||
    filePath === "docs/architecture/domain-boundaries.md" ||
    filePath === "docs/architecture/data-and-integrations.md" ||
    filePath === "docs/architecture/decision-log.md" ||
    filePath === "docs/system/overview.md" ||
    filePath === "docs/engineering/index.md" ||
    filePath === "docs/engineering/current-delivery-risks.md" ||
    filePath === "docs/engineering/migration-plan.md" ||
    filePath === "docs/engineering/testing-strategy.md" ||
    filePath === "docs/engineering/delivery-workflow.md" ||
    filePath === "docs/engineering/verification.md" ||
    filePath === "docs/engineering/command-registry.md" ||
    filePath === "docs/operations/index.md" ||
    filePath === "docs/operations/environments.md" ||
    filePath === "docs/operations/runbooks.md" ||
    filePath === "docs/decisions/index.md" ||
    filePath === "docs/decisions/ADR-0001-repository-baseline.md" ||
    filePath === "docs/work/index.md" ||
    filePath.startsWith("docs/work/") ||
    filePath === "docs/rules/index.md" ||
    filePath === "docs/rules/coding.md" ||
    filePath === "docs/rules/review.md" ||
    filePath === "docs/rules/testing.md" ||
    filePath === "docs/rules/documentation.md" ||
    filePath === "docs/skills/index.md" ||
    filePath === "docs/skills/design.md" ||
    filePath === "docs/skills/testing.md" ||
    filePath === "docs/skills/research.md" ||
    filePath.startsWith("docs/architecture/areas/") ||
    filePath.startsWith("docs/practices/")
  ) {
    return "merge-managed";
  }

  return "user-owned";
}

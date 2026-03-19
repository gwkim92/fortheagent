export type Ownership = "managed" | "merge-managed" | "user-owned";

export function classifyFile(filePath: string): Ownership {
  if (
    filePath === ".agent-foundation/manifest.json" ||
    filePath === ".agent-foundation/profile-registry.json" ||
    filePath === "docs/rules/coding.md" ||
    filePath === "docs/rules/review.md" ||
    filePath === "docs/skills/index.md"
  ) {
    return "managed";
  }

  if (
    filePath === "AGENTS.md" ||
    filePath === "docs/agents/context-map.md" ||
    filePath === "docs/agents/project-discovery.md" ||
    filePath === "docs/architecture/overview.md" ||
    filePath === "docs/architecture/frontend.md" ||
    filePath === "docs/architecture/backend.md" ||
    filePath === "docs/system/overview.md"
  ) {
    return "merge-managed";
  }

  return "user-owned";
}

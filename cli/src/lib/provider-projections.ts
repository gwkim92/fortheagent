export type ProviderProjectionManifest = {
  version: string;
  projections: Array<{
    provider: "codex" | "gemini";
    entryFile: string;
    requiredDocs: string[];
  }>;
};

export function buildProviderProjectionManifest(
  version = "0.1.0"
): ProviderProjectionManifest {
  return {
    version,
    projections: [
      {
        provider: "codex",
        entryFile: "AGENTS.md",
        requiredDocs: [
          "docs/agents/context-map.md",
          "docs/architecture/overview.md",
          "docs/rules/coding.md",
          "docs/rules/review.md",
          "docs/skills/index.md"
        ]
      },
      {
        provider: "gemini",
        entryFile: "GEMINI.md",
        requiredDocs: [
          "docs/agents/context-map.md",
          "docs/architecture/overview.md",
          "docs/rules/coding.md",
          "docs/rules/review.md",
          "docs/skills/index.md"
        ]
      }
    ]
  };
}

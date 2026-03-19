export type ProviderProjection = {
  provider: "codex" | "claude" | "gemini";
  entryFile: string;
  requiredDocs: string[];
};

export type ProviderProjectionManifest = {
  version: string;
  projections: ProviderProjection[];
};

const requiredDocs = [
  "docs/agents/repo-facts.md",
  "docs/index.md",
  ".agent-foundation/handoffs/current.md"
];

export function buildProviderProjectionManifest(
  version = "0.1.0"
): ProviderProjectionManifest {
  return {
    version,
    projections: [
      {
        provider: "codex",
        entryFile: "AGENTS.md",
        requiredDocs
      },
      {
        provider: "claude",
        entryFile: "CLAUDE.md",
        requiredDocs
      },
      {
        provider: "gemini",
        entryFile: "GEMINI.md",
        requiredDocs
      }
    ]
  };
}

function normalizeRef(value: string): string | null {
  const normalized = value.trim().replace(/^@/, "");

  if (!(normalized.endsWith(".md") || normalized.endsWith(".mdc"))) {
    return null;
  }

  if (normalized === "AGENTS.md" || normalized === "CLAUDE.md" || normalized === "GEMINI.md") {
    return null;
  }

  return normalized;
}

function collectInlineCodeRefs(content: string): string[] {
  return [...content.matchAll(/`([^`]+\.(?:md|mdc))`/g)]
    .map((match) => normalizeRef(match[1] ?? ""))
    .filter((value): value is string => Boolean(value));
}

function collectAtImports(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("@"))
    .map((line) => normalizeRef(line.slice(1).split(/\s+/)[0] ?? ""))
    .filter((value): value is string => Boolean(value));
}

export function collectProjectionRefs(entryFile: string, content: string): string[] {
  if (entryFile === "CLAUDE.md") {
    return [...new Set([...collectAtImports(content), ...collectInlineCodeRefs(content)])].sort();
  }

  return [...new Set(collectInlineCodeRefs(content))].sort();
}

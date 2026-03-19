import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { readManifest } from "./current-selection.js";
import type { Manifest } from "./manifest.js";

export type SessionDocument = {
  path: string;
  excerpt: string;
};

export type SessionContext = {
  cwd: string;
  manifest: Manifest;
  documents: SessionDocument[];
  startupPrompt: string;
  userPrompt: string | null;
};

export class RepositoryResolutionError extends Error {
  nextStep: string;

  constructor(message: string, nextStep: string) {
    super(message);
    this.name = "RepositoryResolutionError";
    this.nextStep = nextStep;
  }
}

async function readIfPresent(filePath: string): Promise<string | null> {
  try {
    await access(filePath);
    return await readFile(filePath, "utf8");
  } catch {
    return null;
  }
}

function summarizeDocument(contents: string): string {
  return contents.replace(/\s+/g, " ").trim().slice(0, 240);
}

export async function assertResolvedRepository(cwd: string): Promise<Manifest> {
  const manifest = await readManifest(cwd);

  if (!manifest) {
    throw new RepositoryResolutionError(
      "forTheAgent manifest not found",
      "fortheagent-cli"
    );
  }

  if (manifest.status !== "resolved") {
    throw new RepositoryResolutionError(
      "Repository is initialized but discovery has not been completed",
      "fortheagent-cli"
    );
  }

  return manifest;
}

export async function buildSessionContext(
  cwd: string,
  optionalPrompt?: string
): Promise<SessionContext> {
  const manifest = await assertResolvedRepository(cwd);
  const candidateFiles = [
    "AGENTS.md",
    "CLAUDE.md",
    ".agent-foundation/handoffs/current.md",
    "docs/work/index.md",
    "docs/agents/context-map.md",
    "docs/agents/docs-contract.md",
    "docs/agents/repo-facts.md",
    "docs/architecture/overview.md",
    "docs/architecture/frontend.md",
    "docs/architecture/backend.md",
    "docs/system/overview.md",
    "docs/engineering/command-registry.md",
    "docs/rules/coding.md",
    "docs/rules/review.md"
  ];
  const activeWorkItem = manifest.workflowState.activeWorkItem;
  const filesToRead = activeWorkItem
    ? [...candidateFiles, activeWorkItem]
    : candidateFiles;

  const documents: SessionDocument[] = [];

  for (const relativePath of filesToRead) {
    const contents = await readIfPresent(path.join(cwd, relativePath));

    if (contents) {
      documents.push({
        path: relativePath,
        excerpt: summarizeDocument(contents)
      });
    }
  }

  const startupPrompt = [
    "You are starting from a resolved forTheAgent repository.",
    `projectPhase: ${manifest.projectPhase}`,
    `frontend: ${manifest.frontend ?? "none"}`,
    `backend: ${manifest.backend ?? "none"}`,
    `systemType: ${manifest.systemType ?? "none"}`,
    `architectureStyle: ${manifest.architectureStyle ?? "none"}`,
    `constraints: ${manifest.constraints.join(", ") || "none"}`,
    `practiceProfiles: ${manifest.practiceProfiles.join(", ") || "none"}`,
    "",
    "Key documents:",
    ...documents.map((document) => `- ${document.path}: ${document.excerpt}`)
  ]
    .filter(Boolean)
    .join("\n");

  return {
    cwd,
    manifest,
    documents,
    startupPrompt,
    userPrompt: optionalPrompt ?? null
  };
}

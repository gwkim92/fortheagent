import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { classifyFile } from "./file-ownership.js";
import {
  applyDocFrontmatter,
  buildDocHealthManifest,
  buildDocIndexManifest,
  buildSubtreeAreaDocPath,
  describeDocument
} from "./doc-contract.js";
import { type Manifest } from "./manifest.js";
import { mergeManagedContent } from "./markers.js";
import { resolveManifestPath, resolveProfileRegistryPath } from "./paths.js";
import { buildRepositoryFileContent } from "./foundation-content.js";
import { buildContextBudgetManifest } from "./context-budget.js";
import { profileRegistry, type ProfileRegistry } from "./profile-registry.js";
import { buildProviderProjectionManifest } from "./provider-projections.js";
import { scanRepository } from "./repo-scan.js";
import { listTemplateFiles, toRepositoryPath } from "./templates.js";
import {
  applyDefaultWorkflowState,
  buildInitialDecisionDocPath,
  resolveActiveWorkItemPath
} from "./workflow-state.js";

export type RenderSummary = {
  updated: string[];
  conflicted: string[];
};

const BASE_GENERATED_FILES = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".agent-foundation/handoff/design-ready.md",
  ".agent-foundation/handoffs/current.md",
  "docs/index.md",
  "docs/agents/context-map.md",
  "docs/agents/repo-facts.md",
  "docs/agents/design-handoff.md",
  "docs/agents/docs-contract.md",
  "docs/product/index.md",
  "docs/product/problem-and-users.md",
  "docs/product/domain-glossary.md",
  "docs/product/constraints.md",
  "docs/architecture/overview.md",
  "docs/architecture/domain-boundaries.md",
  "docs/architecture/data-and-integrations.md",
  "docs/architecture/decision-log.md",
  "docs/engineering/index.md",
  "docs/engineering/testing-strategy.md",
  "docs/engineering/delivery-workflow.md",
  "docs/engineering/verification.md",
  "docs/engineering/command-registry.md",
  "docs/rules/index.md",
  "docs/rules/coding.md",
  "docs/rules/review.md",
  "docs/rules/testing.md",
  "docs/rules/documentation.md",
  "docs/skills/index.md",
  "docs/skills/design.md",
  "docs/skills/testing.md",
  "docs/skills/research.md",
  "docs/operations/index.md",
  "docs/operations/environments.md",
  "docs/operations/runbooks.md",
  "docs/decisions/index.md",
  "docs/decisions/ADR-0001-template.md",
  "docs/work/index.md",
  ".agents/skills/docs-writer/SKILL.md",
  ".agents/skills/repo-review/SKILL.md",
  ".agents/skills/verification/SKILL.md",
  ".agents/skills/architecture-brief/SKILL.md",
  ".claude/rules/index.md",
  ".claude/rules/architecture.md",
  ".claude/rules/testing.md",
  ".cursor/rules/architecture.mdc",
  ".cursor/rules/testing.mdc"
];

function collectSubtreeGeneratedFiles(subtreeRoots: string[]): string[] {
  return subtreeRoots.flatMap((rootPath) => [
    buildSubtreeAreaDocPath(rootPath),
    path.posix.join(rootPath, "AGENTS.md"),
    path.posix.join(rootPath, "CLAUDE.md"),
    path.posix.join(rootPath, "GEMINI.md")
  ]);
}

async function ensureContractDirectories(cwd: string, dryRun: boolean): Promise<void> {
  if (dryRun) {
    return;
  }

  await Promise.all(
    [
      ".agent-foundation/handoffs/archive",
      "docs/work/active",
      "docs/work/plans",
      "docs/work/reviews",
      "docs/work/archive"
    ].map((directory) => mkdir(path.join(cwd, directory), { recursive: true }))
  );
}

async function readIfExists(targetPath: string): Promise<string | null> {
  try {
    return await readFile(targetPath, "utf8");
  } catch {
    return null;
  }
}

function isArchiveSnapshotPath(filePath: string): boolean {
  return (
    filePath.startsWith("docs/work/archive/") ||
    filePath.startsWith(".agent-foundation/handoffs/archive/")
  );
}

async function listExistingArchiveFiles(cwd: string): Promise<string[]> {
  const archiveDirectories = [
    {
      absolutePath: path.join(cwd, "docs", "work", "archive"),
      relativeRoot: "docs/work/archive"
    },
    {
      absolutePath: path.join(cwd, ".agent-foundation", "handoffs", "archive"),
      relativeRoot: ".agent-foundation/handoffs/archive"
    }
  ];

  const archiveFiles = await Promise.all(
    archiveDirectories.map(async (directory) => {
      try {
        const entries = await readdir(directory.absolutePath, {
          withFileTypes: true
        });

        return entries
          .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
          .map((entry) => path.posix.join(directory.relativeRoot, entry.name));
      } catch {
        return [];
      }
    })
  );

  return archiveFiles.flat().sort();
}

async function writeFileIfChanged(
  targetPath: string,
  content: string,
  dryRun: boolean
): Promise<boolean> {
  const existing = await readIfExists(targetPath);

  if (existing === content) {
    return false;
  }

  if (dryRun) {
    return true;
  }

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, content, "utf8");
  return true;
}

export async function buildDesiredFileContents(options: {
  cwd: string;
  manifest: Manifest;
  registry?: ProfileRegistry;
  extraGeneratedFiles?: string[];
  contentOverrides?: Map<string, string>;
}): Promise<Map<string, string>> {
  const manifest = applyDefaultWorkflowState(options.manifest);
  const registry = options.registry ?? profileRegistry;
  const templateFiles = await listTemplateFiles(manifest, registry);
  const scan = await scanRepository(options.cwd);
  const existingArchiveFiles = await listExistingArchiveFiles(options.cwd);
  const activeWorkItemPath = resolveActiveWorkItemPath(manifest);
  const initialDecisionDocPath = buildInitialDecisionDocPath(manifest.projectPhase);
  const desiredFiles = new Map<string, string>();
  const generatedDocPaths = new Set<string>([
    ...BASE_GENERATED_FILES,
    ...templateFiles.map((templateFile) => toRepositoryPath(templateFile)),
    ...collectSubtreeGeneratedFiles(scan.subtreeRoots),
    ...existingArchiveFiles,
    ...(options.extraGeneratedFiles ?? []),
    ...(activeWorkItemPath ? [activeWorkItemPath] : []),
    ...(initialDecisionDocPath ? [initialDecisionDocPath] : [])
  ]);

  for (const repositoryPath of [...generatedDocPaths].sort()) {
    const existingArchiveContent = isArchiveSnapshotPath(repositoryPath)
      ? await readIfExists(path.join(options.cwd, repositoryPath))
      : null;
    const overriddenContent =
      options.contentOverrides?.get(repositoryPath) ?? existingArchiveContent;
    const content =
      overriddenContent ??
      (await buildRepositoryFileContent(repositoryPath, {
        manifest,
        scan
      }));
    const descriptor = describeDocument(repositoryPath, manifest, scan);

    desiredFiles.set(
      repositoryPath,
      overriddenContent
        ? overriddenContent
        : descriptor?.frontmatter
          ? applyDocFrontmatter(content, descriptor.frontmatter)
          : content
    );
  }

  desiredFiles.set(
    ".agent-foundation/manifest.json",
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  desiredFiles.set(
    ".agent-foundation/profile-registry.json",
    `${JSON.stringify(registry, null, 2)}\n`
  );
  desiredFiles.set(
    ".agent-foundation/provider-projections.json",
    `${JSON.stringify(buildProviderProjectionManifest(manifest.version), null, 2)}\n`
  );
  const docIndex = buildDocIndexManifest({
    version: manifest.version,
    filePaths: desiredFiles.keys(),
    manifest,
    scan
  });
  desiredFiles.set(".agent-foundation/doc-index.json", `${JSON.stringify(docIndex, null, 2)}\n`);
  const docHealth = buildDocHealthManifest({
    version: options.manifest.version,
    manifest,
    docIndex,
    contents: desiredFiles
  });
  desiredFiles.set(
    ".agent-foundation/doc-health.json",
    `${JSON.stringify(docHealth, null, 2)}\n`
  );
  desiredFiles.set(
    ".agent-foundation/context-budget.json",
    `${JSON.stringify(
      buildContextBudgetManifest(
        [...desiredFiles.keys(), ".agent-foundation/context-budget.json"],
        manifest.version
      ),
      null,
      2
    )}\n`
  );

  return desiredFiles;
}

export async function renderFoundation(options: {
  cwd: string;
  manifest: Manifest;
  dryRun?: boolean;
  repair?: boolean;
  registry?: ProfileRegistry;
  extraGeneratedFiles?: string[];
  contentOverrides?: Map<string, string>;
}): Promise<RenderSummary> {
  const desiredFiles = await buildDesiredFileContents(options);
  const updated: string[] = [];
  const conflicted: string[] = [];

  await ensureContractDirectories(options.cwd, options.dryRun ?? false);

  for (const [repositoryPath, content] of desiredFiles.entries()) {
    const targetPath = path.join(options.cwd, repositoryPath);
    const ownership = classifyFile(repositoryPath);
    const existing = await readIfExists(targetPath);
    let nextContent = content;

    if (ownership === "merge-managed" && existing !== null) {
      const merged = mergeManagedContent(content, existing);

      if (merged === null) {
        if (options.repair) {
          nextContent = content;
        } else {
          conflicted.push(repositoryPath);
          continue;
        }
      }

      if (merged !== null) {
        nextContent = merged;
      }
    }

    if (await writeFileIfChanged(targetPath, nextContent, options.dryRun ?? false)) {
      updated.push(repositoryPath);
    }
  }

  return {
    updated: updated.sort(),
    conflicted: conflicted.sort()
  };
}

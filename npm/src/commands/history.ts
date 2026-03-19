import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parseDocFrontmatter } from "../lib/doc-contract.js";
import { readManifest } from "../lib/current-selection.js";
import { detectRepositoryRoot } from "../lib/paths.js";
import { applyDefaultWorkflowState } from "../lib/workflow-state.js";

export type HistoryEntry = {
  state: "current" | "archived";
  workItemPath: string;
  workItemTitle: string;
  completionSummary: string | null;
  lastVerifiedAt: string | null;
  handoffPath: string;
  handoffPresent: boolean;
};

export type HistoryResult =
  | {
      ok: true;
      status: "resolved" | "unresolved";
      workflowMode: "design" | "implementation" | "maintenance";
      activeWorkItem: string | null;
      archivedCount: number;
      entries: HistoryEntry[];
    }
  | {
      ok: false;
      status: "missing";
      reason: string;
    };

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n+/, "");
}

function titleCase(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function fallbackTitle(filePath: string): string {
  const baseName = path.posix.basename(filePath, ".md").replace(/^\d+-/, "");
  return titleCase(baseName);
}

function extractTitle(content: string, filePath: string): string {
  const heading = stripFrontmatter(content)
    .split(/\r?\n/)
    .find((line) => line.startsWith("# "));

  return heading?.slice(2).trim() || fallbackTitle(filePath);
}

function extractCompletionSummary(content: string): string | null {
  const body = stripFrontmatter(content);
  const match = body.match(/## Completion Summary\n([\s\S]*?)(?:\n## |\s*$)/);

  if (!match?.[1]) {
    return null;
  }

  const firstBullet = match[1]
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.startsWith("- "));

  return firstBullet ? firstBullet.slice(2).trim() : null;
}

function extractSequence(filePath: string): number {
  const match = path.posix.basename(filePath).match(/^(\d+)/);
  return match ? Number.parseInt(match[1] ?? "0", 10) : -1;
}

function compareArchivePaths(left: string, right: string): number {
  const leftSequence = extractSequence(left);
  const rightSequence = extractSequence(right);

  if (leftSequence !== rightSequence) {
    return rightSequence - leftSequence;
  }

  return path.posix.basename(right).localeCompare(path.posix.basename(left));
}

async function readEntry(
  cwd: string,
  state: HistoryEntry["state"],
  workItemPath: string,
  handoffPath: string
): Promise<HistoryEntry> {
  const workItemFsPath = path.join(cwd, workItemPath);
  const handoffFsPath = path.join(cwd, handoffPath);

  try {
    const content = await readFile(workItemFsPath, "utf8");
    const frontmatter = parseDocFrontmatter(content);

    return {
      state,
      workItemPath,
      workItemTitle: extractTitle(content, workItemPath),
      completionSummary: extractCompletionSummary(content),
      lastVerifiedAt: frontmatter?.last_verified ?? null,
      handoffPath,
      handoffPresent: await pathExists(handoffFsPath)
    };
  } catch {
    return {
      state,
      workItemPath,
      workItemTitle: fallbackTitle(workItemPath),
      completionSummary: null,
      lastVerifiedAt: null,
      handoffPath,
      handoffPresent: await pathExists(handoffFsPath)
    };
  }
}

async function listArchivedWorkItems(cwd: string): Promise<string[]> {
  const archiveRoot = path.join(cwd, "docs", "work", "archive");

  try {
    const entries = await readdir(archiveRoot, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.posix.join("docs", "work", "archive", entry.name))
      .sort(compareArchivePaths);
  } catch {
    return [];
  }
}

export async function runHistory(options: { cwd: string }): Promise<HistoryResult> {
  const cwd = await detectRepositoryRoot(options.cwd);
  const manifest = await readManifest(cwd);

  if (!manifest) {
    return {
      ok: false,
      status: "missing",
      reason: "fortheagent manifest not found"
    };
  }

  const current = applyDefaultWorkflowState(manifest);
  const archivedWorkItems = await listArchivedWorkItems(cwd);
  const entries: HistoryEntry[] = [];

  if (current.workflowState.activeWorkItem) {
    entries.push(
      await readEntry(
        cwd,
        "current",
        current.workflowState.activeWorkItem,
        ".agent-foundation/handoffs/current.md"
      )
    );
  }

  for (const archivedWorkItem of archivedWorkItems) {
    entries.push(
      await readEntry(
        cwd,
        "archived",
        archivedWorkItem,
        path.posix.join(
          ".agent-foundation",
          "handoffs",
          "archive",
          path.posix.basename(archivedWorkItem)
        )
      )
    );
  }

  return {
    ok: true,
    status: current.status,
    workflowMode: current.workflowState.mode,
    activeWorkItem: current.workflowState.activeWorkItem,
    archivedCount: archivedWorkItems.length,
    entries
  };
}

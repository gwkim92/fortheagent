import path from "node:path";
import type { Manifest } from "./manifest.js";
import type { RepositoryScan } from "./repo-scan.js";
import { getContextBudget } from "./context-budget.js";
import {
  buildInitialDecisionDocPath,
  resolveActiveWorkItemPath
} from "./workflow-state.js";

export type WorkflowMode = "design" | "implementation" | "maintenance";

export type WorkflowState = {
  mode: WorkflowMode;
  activeWorkItem: string | null;
};

export type LoadPolicy = "startup" | "router" | "on-demand" | "path-local" | "archive";

export type DocumentFrontmatter = {
  doc_type: string;
  audience: string;
  load_policy: LoadPolicy;
  owner: string;
  status: string;
  last_verified: string;
  review_after_days: number;
  source_of_truth: string;
  related_docs: string[];
};

export type DocumentDescriptor = {
  path: string;
  frontmatter: DocumentFrontmatter | null;
  startupEligible: boolean;
  tags: string[];
  relatedDocs: string[];
};

export type DocIndexEntry = {
  path: string;
  docType: string;
  loadPolicy: LoadPolicy;
  owner: string;
  maxLines: number | null;
  startupEligible: boolean;
  tags: string[];
  relatedDocs: string[];
};

export type DocIndexManifest = {
  version: string;
  entries: DocIndexEntry[];
};

export type DocHealthEntry = {
  path: string;
  lastGeneratedAt: string;
  lastVerifiedAt: string;
  reviewAfterDays: number;
  stale: boolean;
  orphaned: boolean;
  reachableFromStartup: boolean;
};

export type DocHealthManifest = {
  version: string;
  entries: DocHealthEntry[];
};

const EPOCH_TIMESTAMP = "1970-01-01T00:00:00.000Z";
const EPOCH_DATE = "1970-01-01";

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeDate(value: string | null | undefined): string {
  if (!value) {
    return EPOCH_DATE;
  }

  return value.slice(0, 10);
}

function normalizeTimestamp(value: string | null | undefined): string {
  return value ?? EPOCH_TIMESTAMP;
}

function sanitizeSubtreeSlug(rootPath: string): string {
  return rootPath.replaceAll(path.sep, "--").replaceAll("/", "--");
}

export function buildSubtreeAreaDocPath(rootPath: string): string {
  return path.posix.join("docs", "architecture", "areas", `${sanitizeSubtreeSlug(rootPath)}.md`);
}

export function isRootAdapter(filePath: string): boolean {
  return filePath === "AGENTS.md" || filePath === "CLAUDE.md" || filePath === "GEMINI.md";
}

export function isSubtreeAdapter(filePath: string): boolean {
  const baseName = path.posix.basename(filePath);

  if (!(baseName === "AGENTS.md" || baseName === "CLAUDE.md" || baseName === "GEMINI.md")) {
    return false;
  }

  return path.posix.dirname(filePath) !== ".";
}

export function isDocFrontmatterFile(filePath: string): boolean {
  if (isRootAdapter(filePath)) {
    return false;
  }

  return (
    filePath.startsWith("docs/") ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath.startsWith(".agent-foundation/handoffs/archive/") ||
    filePath === ".agent-foundation/handoff/design-ready.md" ||
    isSubtreeAdapter(filePath)
  );
}

export function buildDefaultWorkflowState(): WorkflowState {
  return {
    mode: "design",
    activeWorkItem: null
  };
}

export function buildManagedTimestamp(manifest: Manifest): string {
  return normalizeTimestamp(manifest.lastResolvedAt ?? manifest.generatedAt);
}

export function buildManagedDate(manifest: Manifest): string {
  return normalizeDate(manifest.lastResolvedAt ?? manifest.generatedAt);
}

function buildSourceOfTruth(filePath: string): string {
  if (filePath === "docs/agents/repo-facts.md" || filePath === "docs/engineering/command-registry.md") {
    return ".agent-foundation/manifest.json + repository scan";
  }

  if (filePath === ".agent-foundation/handoffs/current.md") {
    return ".agent-foundation/manifest.json";
  }

  if (filePath.startsWith(".agent-foundation/handoffs/archive/")) {
    return ".agent-foundation/handoffs/current.md snapshot";
  }

  if (filePath.startsWith("docs/architecture/areas/")) {
    return ".agent-foundation/manifest.json + repository scan";
  }

  if (
    filePath.startsWith("docs/work/active/") ||
    filePath === "docs/decisions/ADR-0001-repository-baseline.md"
  ) {
    return ".agent-foundation/manifest.json + repository scan";
  }

  if (filePath === "docs/architecture/decision-log.md") {
    return "docs/decisions/index.md";
  }

  return filePath;
}

function buildReviewAfterDays(filePath: string): number {
  if (
    filePath === "docs/index.md" ||
    filePath === "docs/agents/repo-facts.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath === "docs/engineering/command-registry.md"
  ) {
    return 7;
  }

  if (filePath.startsWith("docs/work/")) {
    return 7;
  }

  if (filePath.startsWith("docs/operations/")) {
    return 14;
  }

  if (filePath.startsWith("docs/decisions/")) {
    return 30;
  }

  return 30;
}

function buildDocType(filePath: string): string {
  if (isSubtreeAdapter(filePath)) {
    return "subtree-adapter";
  }

  if (isRootAdapter(filePath)) {
    return "root-adapter";
  }

  if (filePath.startsWith("docs/product/")) {
    return "product";
  }

  if (filePath.startsWith("docs/system/")) {
    return "system";
  }

  if (filePath.startsWith("docs/architecture/")) {
    return "architecture";
  }

  if (filePath.startsWith("docs/engineering/")) {
    return "engineering";
  }

  if (filePath.startsWith("docs/operations/")) {
    return "operations";
  }

  if (filePath.startsWith("docs/decisions/")) {
    return "decision";
  }

  if (filePath.startsWith("docs/work/")) {
    return "work";
  }

  if (filePath.startsWith("docs/agents/")) {
    return "agent-meta";
  }

  if (filePath.startsWith("docs/rules/")) {
    return "rules";
  }

  if (filePath.startsWith("docs/skills/")) {
    return "skills";
  }

  if (filePath.startsWith(".agent-foundation/handoffs/") || filePath.startsWith(".agent-foundation/handoff/")) {
    return "handoff";
  }

  return "document";
}

function buildLoadPolicy(filePath: string): LoadPolicy {
  if (isSubtreeAdapter(filePath)) {
    return "path-local";
  }

  if (filePath === "docs/agents/repo-facts.md" || filePath === ".agent-foundation/handoffs/current.md") {
    return "startup";
  }

  if (
    filePath === "docs/index.md" ||
    filePath.endsWith("/index.md") ||
    filePath === "docs/agents/context-map.md"
  ) {
    return "router";
  }

  if (filePath.startsWith("docs/work/archive/") || filePath.startsWith(".agent-foundation/handoffs/archive/")) {
    return "archive";
  }

  return "on-demand";
}

function buildAudience(filePath: string): string {
  if (isSubtreeAdapter(filePath) || filePath.startsWith("docs/agents/")) {
    return "agent";
  }

  if (filePath.startsWith("docs/work/")) {
    return "agent-and-human";
  }

  return "human-and-agent";
}

function buildOwner(filePath: string): string {
  if (
    filePath === "docs/agents/repo-facts.md" ||
    filePath === "docs/engineering/command-registry.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath.startsWith(".agent-foundation/handoffs/archive/")
  ) {
    return "foundation";
  }

  return "team";
}

function buildStatus(filePath: string): string {
  if (filePath === "docs/decisions/ADR-0001-template.md") {
    return "template";
  }

  if (
    filePath === "docs/agents/repo-facts.md" ||
    filePath === "docs/engineering/command-registry.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    filePath.startsWith(".agent-foundation/handoffs/archive/")
  ) {
    return "generated";
  }

  return "draft";
}

function buildRelatedDocs(
  filePath: string,
  manifest: Manifest,
  scan: RepositoryScan
): string[] {
  const decisionIndex = "docs/decisions/index.md";
  const commandRegistry = "docs/engineering/command-registry.md";
  const currentHandoff = ".agent-foundation/handoffs/current.md";
  const activeWorkItem = resolveActiveWorkItemPath(manifest);
  const initialDecisionDoc = buildInitialDecisionDocPath(manifest.projectPhase);
  const activeConstraintDocs = manifest.constraints.map(
    (constraint) => `docs/product/constraints/${constraint}.md`
  );
  const activePracticeDocs = manifest.practiceProfiles.map(
    (practice) => `docs/practices/${practice}.md`
  );
  const activeProfileDocs = [
    manifest.frontend && manifest.frontend !== "none" ? "docs/architecture/frontend.md" : null,
    manifest.backend && manifest.backend !== "none" ? "docs/architecture/backend.md" : null,
    manifest.systemType ? "docs/system/overview.md" : null
  ].filter((value): value is string => value !== null);

  if (isRootAdapter(filePath)) {
    return ["docs/agents/repo-facts.md", "docs/index.md", currentHandoff];
  }

  if (isSubtreeAdapter(filePath)) {
    const subtreeRoot = path.posix.dirname(filePath);
    return [buildSubtreeAreaDocPath(subtreeRoot), commandRegistry];
  }

  switch (filePath) {
    case currentHandoff:
      return unique([
        "docs/agents/repo-facts.md",
        "docs/index.md",
        "docs/work/index.md",
        commandRegistry,
        ...(activeWorkItem ? [activeWorkItem] : [])
      ]);
    case ".agent-foundation/handoff/design-ready.md":
      return ["docs/agents/design-handoff.md", "docs/architecture/overview.md", currentHandoff];
    case "docs/index.md":
      return unique([
        "docs/agents/repo-facts.md",
        currentHandoff,
        "docs/agents/context-map.md",
        "docs/agents/docs-contract.md",
        "docs/product/index.md",
        "docs/architecture/overview.md",
        "docs/engineering/index.md",
        "docs/operations/index.md",
        decisionIndex,
        "docs/work/index.md",
        "docs/rules/index.md",
        "docs/skills/index.md",
        ...(activeWorkItem ? [activeWorkItem] : []),
        ...(initialDecisionDoc ? [initialDecisionDoc] : []),
        ...(manifest.projectPhase === "existing"
          ? [
              "docs/architecture/current-state.md",
              "docs/architecture/refactor-target.md",
              "docs/engineering/current-delivery-risks.md",
              "docs/engineering/migration-plan.md"
            ]
          : []),
        ...activeConstraintDocs,
        ...activePracticeDocs,
        ...activeProfileDocs
      ]);
    case "docs/agents/repo-facts.md":
      return ["docs/index.md", currentHandoff, commandRegistry];
    case "docs/agents/context-map.md":
      return [
        "docs/index.md",
        "docs/agents/design-handoff.md",
        "docs/agents/docs-contract.md",
        currentHandoff
      ];
    case "docs/agents/design-handoff.md":
      return [
        "docs/index.md",
        currentHandoff,
        ".agent-foundation/handoff/design-ready.md",
        "docs/product/problem-and-users.md",
        "docs/architecture/overview.md",
        "docs/engineering/verification.md"
      ];
    case "docs/agents/docs-contract.md":
      return ["docs/index.md", currentHandoff, commandRegistry];
    case "docs/product/index.md":
      return unique([
        "docs/product/problem-and-users.md",
        "docs/product/domain-glossary.md",
        "docs/product/constraints.md",
        ...activeConstraintDocs
      ]);
    case "docs/product/problem-and-users.md":
      return ["docs/product/index.md", "docs/architecture/overview.md"];
    case "docs/product/domain-glossary.md":
      return ["docs/product/index.md", "docs/architecture/domain-boundaries.md"];
    case "docs/product/constraints.md":
      return unique(["docs/product/index.md", "docs/engineering/verification.md", ...activeConstraintDocs]);
    case "docs/architecture/overview.md":
      return unique([
        "docs/architecture/domain-boundaries.md",
        "docs/architecture/data-and-integrations.md",
        "docs/architecture/decision-log.md",
        ...(manifest.projectPhase === "existing"
          ? ["docs/architecture/current-state.md", "docs/architecture/refactor-target.md"]
          : []),
        ...activeProfileDocs
      ]);
    case "docs/architecture/current-state.md":
      return [
        "docs/architecture/overview.md",
        "docs/architecture/refactor-target.md",
        "docs/engineering/migration-plan.md"
      ];
    case "docs/architecture/refactor-target.md":
      return ["docs/architecture/overview.md", "docs/engineering/migration-plan.md", decisionIndex];
    case "docs/architecture/decision-log.md":
      return [decisionIndex];
    case "docs/engineering/index.md":
      return unique([
        commandRegistry,
        "docs/engineering/testing-strategy.md",
        "docs/engineering/delivery-workflow.md",
        "docs/operations/index.md",
        ...(manifest.projectPhase === "existing"
          ? ["docs/engineering/current-delivery-risks.md", "docs/engineering/migration-plan.md"]
          : ["docs/engineering/testing-strategy.md", "docs/engineering/verification.md"]),
        ...activePracticeDocs
      ]);
    case "docs/rules/index.md":
      return [
        "docs/rules/coding.md",
        "docs/rules/review.md",
        "docs/rules/testing.md",
        "docs/rules/documentation.md",
        commandRegistry
      ];
    case "docs/skills/index.md":
      return [
        "docs/skills/design.md",
        "docs/skills/testing.md",
        "docs/skills/research.md"
      ];
    case commandRegistry:
      return ["docs/engineering/index.md", "docs/operations/index.md", currentHandoff];
    case "docs/operations/index.md":
      return [commandRegistry, "docs/operations/environments.md", "docs/operations/runbooks.md"];
    case "docs/decisions/index.md":
      return unique([
        "docs/architecture/decision-log.md",
        "docs/decisions/ADR-0001-template.md",
        ...(initialDecisionDoc ? [initialDecisionDoc] : [])
      ]);
    case "docs/decisions/ADR-0001-repository-baseline.md":
      return [
        "docs/decisions/index.md",
        "docs/architecture/current-state.md",
        "docs/architecture/refactor-target.md",
        "docs/engineering/migration-plan.md"
      ];
    case "docs/decisions/ADR-0001-template.md":
      return ["docs/decisions/index.md"];
    case "docs/work/index.md":
      return unique([
        currentHandoff,
        commandRegistry,
        decisionIndex,
        ...(activeWorkItem ? [activeWorkItem] : [])
      ]);
    default:
      break;
  }

  if (filePath.startsWith("docs/product/constraints/")) {
    return ["docs/product/constraints.md", "docs/engineering/verification.md"];
  }

  if (filePath.startsWith("docs/architecture/areas/")) {
    return ["docs/index.md", commandRegistry];
  }

  if (filePath.startsWith("docs/system/")) {
    return ["docs/index.md", "docs/architecture/overview.md", commandRegistry];
  }

  if (filePath.startsWith("docs/architecture/")) {
    return ["docs/index.md", commandRegistry];
  }

  if (filePath.startsWith("docs/engineering/")) {
    return ["docs/engineering/index.md", commandRegistry];
  }

  if (filePath.startsWith("docs/operations/")) {
    return ["docs/operations/index.md", commandRegistry];
  }

  if (filePath.startsWith("docs/rules/")) {
    return ["docs/index.md", commandRegistry];
  }

  if (filePath.startsWith("docs/skills/")) {
    return ["docs/index.md", "docs/skills/index.md"];
  }

  if (filePath.startsWith("docs/practices/")) {
    return ["docs/engineering/verification.md", "docs/architecture/overview.md"];
  }

  if (filePath.startsWith("docs/work/active/")) {
    return unique([
      "docs/work/index.md",
      currentHandoff,
      commandRegistry,
      ...(initialDecisionDoc ? [initialDecisionDoc] : [])
    ]);
  }

  if (filePath.startsWith("docs/work/plans/")) {
    return ["docs/work/index.md", decisionIndex];
  }

  if (filePath.startsWith("docs/work/reviews/")) {
    return ["docs/work/index.md", "docs/engineering/verification.md"];
  }

  if (manifest.projectPhase === "existing" && filePath === "docs/engineering/migration-plan.md") {
    return ["docs/architecture/current-state.md", "docs/architecture/refactor-target.md"];
  }

  if (scan.subtreeRoots.length > 0 && filePath === commandRegistry) {
    return unique([commandRegistry, ...scan.subtreeRoots.map((rootPath) => buildSubtreeAreaDocPath(rootPath))]);
  }

  return ["docs/index.md"];
}

function buildTags(filePath: string, manifest: Manifest): string[] {
  const tags = [buildDocType(filePath), buildLoadPolicy(filePath)];

  if (manifest.projectPhase === "existing") {
    tags.push("existing");
  } else {
    tags.push("greenfield");
  }

  if (isSubtreeAdapter(filePath)) {
    tags.push(`subtree:${path.posix.dirname(filePath)}`);
  }

  if (filePath.startsWith("docs/architecture/areas/")) {
    tags.push("subtree-area");
  }

  if (filePath.startsWith("docs/product/constraints/")) {
    tags.push("constraint");
  }

  return unique(tags);
}

export function describeDocument(
  filePath: string,
  manifest: Manifest,
  scan: RepositoryScan
): DocumentDescriptor | null {
  const relatedDocs = buildRelatedDocs(filePath, manifest, scan);
  const loadPolicy = buildLoadPolicy(filePath);
  const startupEligible =
    isRootAdapter(filePath) ||
    filePath === "docs/agents/repo-facts.md" ||
    filePath === "docs/index.md" ||
    filePath === ".agent-foundation/handoffs/current.md" ||
    isSubtreeAdapter(filePath);

  if (isRootAdapter(filePath)) {
    return {
      path: filePath,
      frontmatter: null,
      startupEligible,
      tags: buildTags(filePath, manifest),
      relatedDocs
    };
  }

  if (!isDocFrontmatterFile(filePath)) {
    return null;
  }

  return {
    path: filePath,
    frontmatter: {
      doc_type: buildDocType(filePath),
      audience: buildAudience(filePath),
      load_policy: loadPolicy,
      owner: buildOwner(filePath),
      status: buildStatus(filePath),
      last_verified: buildManagedDate(manifest),
      review_after_days: buildReviewAfterDays(filePath),
      source_of_truth: buildSourceOfTruth(filePath),
      related_docs: relatedDocs
    },
    startupEligible,
    tags: buildTags(filePath, manifest),
    relatedDocs
  };
}

export function renderFrontmatter(frontmatter: DocumentFrontmatter): string {
  return ["---", JSON.stringify(frontmatter, null, 2), "---", ""].join("\n");
}

export function applyDocFrontmatter(content: string, frontmatter: DocumentFrontmatter): string {
  const normalized = content.replace(/^(---\n[\s\S]*?\n---\n+)/, "");
  return `${renderFrontmatter(frontmatter)}${normalized}`;
}

export function parseDocFrontmatter(content: string): DocumentFrontmatter | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[1]) as DocumentFrontmatter;
  } catch {
    return null;
  }
}

export function buildDocIndexManifest(options: {
  version: string;
  filePaths: Iterable<string>;
  manifest: Manifest;
  scan: RepositoryScan;
}): DocIndexManifest {
  const entries = [...new Set(options.filePaths)]
    .map((filePath) => describeDocument(filePath, options.manifest, options.scan))
    .filter((value): value is DocumentDescriptor => Boolean(value))
    .map((descriptor) => ({
      path: descriptor.path,
      docType: descriptor.frontmatter?.doc_type ?? buildDocType(descriptor.path),
      loadPolicy: descriptor.frontmatter?.load_policy ?? buildLoadPolicy(descriptor.path),
      owner: descriptor.frontmatter?.owner ?? buildOwner(descriptor.path),
      maxLines: getContextBudget(descriptor.path),
      startupEligible: descriptor.startupEligible,
      tags: descriptor.tags,
      relatedDocs: descriptor.relatedDocs
    }))
    .sort((left, right) => left.path.localeCompare(right.path));

  return {
    version: options.version,
    entries
  };
}

function computeReachablePaths(entries: DocIndexEntry[]): Set<string> {
  const reachable = new Set<string>();
  const queue = entries
    .filter(
      (entry) =>
        entry.startupEligible ||
        entry.path === "docs/index.md" ||
        entry.path === ".agent-foundation/handoffs/current.md"
    )
    .map((entry) => entry.path);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current || reachable.has(current)) {
      continue;
    }

    reachable.add(current);

    const entry = entries.find((candidate) => candidate.path === current);

    for (const relatedDoc of entry?.relatedDocs ?? []) {
      if (!reachable.has(relatedDoc)) {
        queue.push(relatedDoc);
      }
    }
  }

  return reachable;
}

export function buildDocHealthManifest(options: {
  version: string;
  manifest: Manifest;
  docIndex: DocIndexManifest;
  contents: Map<string, string>;
}): DocHealthManifest {
  const now = new Date(buildManagedTimestamp(options.manifest));
  const reachablePaths = computeReachablePaths(options.docIndex.entries);

  return {
    version: options.version,
    entries: options.docIndex.entries.map((entry) => {
      const content = options.contents.get(entry.path) ?? "";
      const frontmatter = parseDocFrontmatter(content);
      const lastVerifiedAt = frontmatter?.last_verified
        ? `${frontmatter.last_verified}T00:00:00.000Z`
        : buildManagedTimestamp(options.manifest);
      const reviewAfterDays = frontmatter?.review_after_days ?? 30;
      const deadline = new Date(lastVerifiedAt);
      deadline.setUTCDate(deadline.getUTCDate() + reviewAfterDays);
      const reachableFromStartup = reachablePaths.has(entry.path);

      return {
        path: entry.path,
        lastGeneratedAt: buildManagedTimestamp(options.manifest),
        lastVerifiedAt,
        reviewAfterDays,
        stale: deadline.getTime() < now.getTime(),
        orphaned: entry.loadPolicy !== "archive" && !reachableFromStartup,
        reachableFromStartup
      };
    })
  };
}

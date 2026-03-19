import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { classifyFile } from "../lib/file-ownership.js";
import { buildDesiredFileContents } from "../lib/render.js";
import {
  buildContextBudgetManifest,
  countLines,
  type ContextBudgetManifest
} from "../lib/context-budget.js";
import {
  buildDocHealthManifest,
  buildDocIndexManifest,
  isDocFrontmatterFile,
  parseDocFrontmatter,
  type DocumentFrontmatter
} from "../lib/doc-contract.js";
import { scanRepository } from "../lib/repo-scan.js";
import { parseManifest, validateManifest } from "../lib/manifest.js";
import { hasValidManagedMarkers } from "../lib/markers.js";
import {
  detectRepositoryRoot,
  resolveManifestPath,
  resolveProfileRegistryPath
} from "../lib/paths.js";
import {
  collectExpectedTemplateRoots,
  collectExpectedOutputs,
  collectKnownOverlayOutputs,
  loadProfileRegistry,
  PROFILE_REGISTRY_MIGRATION_TARGET,
  validateProfileRegistry,
  validateProfileRegistryTemplates
} from "../lib/profile-registry.js";
import {
  buildProviderProjectionManifest,
  type ProviderProjectionManifest
} from "../lib/provider-projections.js";
import { validateProjectionParity } from "../lib/projection-parity.js";
import {
  applyDefaultWorkflowState,
  resolveActiveWorkItemPath
} from "../lib/workflow-state.js";

const requiredBaseFiles = [
  "AGENTS.md",
  "CLAUDE.md",
  "GEMINI.md",
  ".agent-foundation/manifest.json",
  ".agent-foundation/profile-registry.json",
  ".agent-foundation/context-budget.json",
  ".agent-foundation/provider-projections.json",
  ".agent-foundation/doc-index.json",
  ".agent-foundation/doc-health.json",
  ".agent-foundation/handoff/design-ready.md",
  ".agent-foundation/handoffs/current.md",
  ".agents/skills/docs-writer/SKILL.md",
  ".agents/skills/repo-review/SKILL.md",
  ".agents/skills/verification/SKILL.md",
  ".agents/skills/architecture-brief/SKILL.md",
  ".claude/rules/index.md",
  ".claude/rules/architecture.md",
  ".claude/rules/testing.md",
  ".cursor/rules/architecture.mdc",
  ".cursor/rules/testing.mdc",
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
  "docs/operations/index.md",
  "docs/operations/environments.md",
  "docs/operations/runbooks.md",
  "docs/decisions/index.md",
  "docs/decisions/ADR-0001-template.md",
  "docs/work/index.md",
  "docs/rules/index.md",
  "docs/rules/coding.md",
  "docs/rules/review.md",
  "docs/rules/testing.md",
  "docs/rules/documentation.md",
  "docs/skills/index.md",
  "docs/skills/design.md",
  "docs/skills/testing.md",
  "docs/skills/research.md"
];

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function normalizeRuleRef(ref: string): string | null {
  const normalized = ref.trim().replace(/^@/, "");

  if (!(normalized.endsWith(".md") || normalized.endsWith(".mdc"))) {
    return null;
  }

  if (
    normalized === "AGENTS.md" ||
    normalized === "CLAUDE.md" ||
    normalized === "GEMINI.md"
  ) {
    return null;
  }

  return normalized;
}

function collectInlineCodeRefs(content: string): string[] {
  return [...content.matchAll(/`([^`]+\.(?:md|mdc))`/g)]
    .map((match) => normalizeRuleRef(match[1]))
    .filter((value): value is string => Boolean(value));
}

function collectClaudeImports(content: string): string[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("@"))
    .map((line) => normalizeRuleRef(line.slice(1).split(/\s+/)[0] ?? ""))
    .filter((value): value is string => Boolean(value));
}

function validateAlwaysLoadedSurface(contents: Map<string, string>): string[] {
  const warnings: string[] = [];
  const agentsRefs = unique(collectInlineCodeRefs(contents.get("AGENTS.md") ?? ""));
  const claudeImports = unique(collectClaudeImports(contents.get("CLAUDE.md") ?? ""));
  const geminiRefs = unique(collectInlineCodeRefs(contents.get("GEMINI.md") ?? ""));
  const handoffRefs = unique(
    collectInlineCodeRefs(contents.get(".agent-foundation/handoffs/current.md") ?? "")
  ).filter((ref) => !ref.startsWith("docs/work/active/"));
  const alwaysLoadedRefs = unique([...agentsRefs, ...claudeImports, ...geminiRefs, ...handoffRefs]);

  if (agentsRefs.length > 3) {
    warnings.push(
      `Context surface warning: AGENTS.md references ${agentsRefs.length} docs (budget 3)`
    );
  }

  if (claudeImports.length > 3) {
    warnings.push(
      `Context surface warning: CLAUDE.md imports ${claudeImports.length} docs (budget 3)`
    );
  }

  if (geminiRefs.length > 3) {
    warnings.push(
      `Context surface warning: GEMINI.md references ${geminiRefs.length} docs (budget 3)`
    );
  }

  if (alwaysLoadedRefs.length > 3) {
    warnings.push(
      `Context surface warning: always-loaded startup surface references ${alwaysLoadedRefs.length} docs (budget 3)`
    );
  }

  return warnings.sort();
}

function stripLeadingFrontmatter(content: string): string {
  if (!content.startsWith("---\n")) {
    return content;
  }

  const closingIndex = content.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    return content;
  }

  return content.slice(closingIndex + 5);
}

function collectDuplicateGuidanceWarnings(contents: Map<string, string>): string[] {
  const seen = new Map<string, Set<string>>();

  for (const [filePath, content] of contents.entries()) {
    if (
      !(
        filePath === "AGENTS.md" ||
        filePath === "CLAUDE.md" ||
        filePath === "GEMINI.md" ||
        filePath === "docs/index.md" ||
        filePath.startsWith("docs/") ||
        filePath === ".agent-foundation/handoff/design-ready.md" ||
        filePath === ".agent-foundation/handoffs/current.md" ||
        filePath.startsWith(".claude/rules/")
      )
    ) {
      continue;
    }

    for (const rawLine of stripLeadingFrontmatter(content).split("\n")) {
      const line = rawLine.trim();

      if (
        line.length < 50 ||
        line.startsWith("#") ||
        line.startsWith("<!--") ||
        line.startsWith("## ") ||
        line.endsWith("?") ||
        line.startsWith("- What ") ||
        line.startsWith("- Who ") ||
        line.startsWith("- Which ") ||
        line.startsWith("- Do ") ||
        line.startsWith("- How ") ||
        line.startsWith("- When ") ||
        line.startsWith("- Where ") ||
        line.startsWith("- Why ") ||
        line.startsWith("- Foundation status:") ||
        line.startsWith("- Project phase:") ||
        line.startsWith("- Repository root:") ||
        line.startsWith("- Package manager:") ||
        line.startsWith("- Automation install command:") ||
        line.startsWith("- Workspace layout:") ||
        line.startsWith("- Package name:") ||
        line.startsWith("- Existing CI workflows:") ||
        line.startsWith("- Frontend profile:") ||
        line.startsWith("- Backend profile:") ||
        line.startsWith("- Project type:") ||
        line.startsWith("- Architecture style:") ||
        line.startsWith("- Active constraints:") ||
        line.startsWith("- Active practice profiles:") ||
        line.startsWith("- Active quality profiles:") ||
        line.startsWith("- Frontend hints from scan:") ||
        line.startsWith("- Backend hints from scan:") ||
        line.startsWith("- Route structure detected in:") ||
        line.startsWith("- API-related directories detected in:") ||
        line.startsWith("- Data layer hints:") ||
        line.startsWith("- Realtime tooling hints:") ||
        line.startsWith("- Data tooling hints:") ||
        line.startsWith("- Testing and validation hints:") ||
        line.startsWith("- Meaningful package scripts:") ||
        line.startsWith("- Route surfaces already present:") ||
        line.startsWith("- API surfaces already present:") ||
        line.startsWith("- Data-related surfaces already present:") ||
        line.startsWith("- Realtime surfaces already present:") ||
        line.startsWith("- Current validation signals:") ||
        line.startsWith("- Existing workflow files:") ||
        line.startsWith("- Existing docs under docs/:") ||
        line.startsWith("- System type hints from scan:") ||
        line.startsWith("- Architecture style hints from scan:") ||
        line.startsWith("- Phase recommendation from scan:") ||
        line.startsWith("- Phase recommendation reasons:") ||
        line.startsWith("- Recommended setup path:") ||
        line.startsWith("Add project-specific design notes below this line.") ||
        line.startsWith("Use these files as optional, task-specific imports") ||
        line.startsWith("Use deeper docs only") ||
        line.startsWith("Open deeper docs only") ||
        line.startsWith("Load deeper docs only")
      ) {
        continue;
      }

      const files = seen.get(line) ?? new Set<string>();
      files.add(filePath);
      seen.set(line, files);
    }
  }

  return [...seen.entries()]
    .filter(([, files]) => files.size >= 4)
    .sort((left, right) => right[1].size - left[1].size || left[0].localeCompare(right[0]))
    .slice(0, 5)
    .map(
      ([line, files]) =>
        `Context duplication warning: repeated guidance line appears in ${files.size} files: ${line}`
    );
}

function validateFrontmatter(content: string, filePath: string): {
  errors: string[];
  warnings: string[];
} {
  const frontmatter = parseDocFrontmatter(content);

  if (!frontmatter) {
    return {
      errors: [`Missing or invalid document frontmatter: ${filePath}`],
      warnings: []
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  const requiredKeys: Array<keyof DocumentFrontmatter> = [
    "doc_type",
    "audience",
    "load_policy",
    "owner",
    "status",
    "last_verified",
    "review_after_days",
    "source_of_truth",
    "related_docs"
  ];

  for (const key of requiredKeys) {
    const value = frontmatter[key];

    if (
      value === undefined ||
      value === null ||
      (typeof value === "string" && value.trim().length === 0)
    ) {
      errors.push(`Document frontmatter is missing ${key}: ${filePath}`);
    }
  }

  if (
    !["startup", "router", "on-demand", "path-local", "archive"].includes(
      frontmatter.load_policy
    )
  ) {
    errors.push(`Invalid load_policy in document frontmatter: ${filePath}`);
  }

  if (Number.isNaN(Date.parse(`${frontmatter.last_verified}T00:00:00.000Z`))) {
    errors.push(`Invalid last_verified value in document frontmatter: ${filePath}`);
  }

  if (!Array.isArray(frontmatter.related_docs)) {
    errors.push(`Invalid related_docs in document frontmatter: ${filePath}`);
  }

  if (
    (filePath.endsWith("/AGENTS.md") ||
      filePath.endsWith("/CLAUDE.md") ||
      filePath.endsWith("/GEMINI.md")) &&
    filePath !== "AGENTS.md" &&
    filePath !== "CLAUDE.md" &&
    filePath !== "GEMINI.md"
  ) {
    const allowed = [
      `docs/architecture/areas/${path.posix.dirname(filePath).replaceAll("/", "--")}.md`,
      "docs/engineering/command-registry.md"
    ].sort();
    const actual = [...frontmatter.related_docs].sort();

    const missing = allowed.filter((value) => !actual.includes(value));
    const extra = actual.filter((value) => !allowed.includes(value));

    if (missing.length > 0) {
      warnings.push(
        `Subtree adapter warning: ${filePath} is missing expected local references: ${missing.join(", ")}`
      );
    }

    if (extra.length > 0) {
      warnings.push(
        `Subtree adapter warning: ${filePath} references additional docs beyond the local minimum: ${extra.join(", ")}`
      );
    }
  }

  return {
    errors,
    warnings
  };
}

function parseSkillFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n/);

  if (!match) {
    return null;
  }

  const fields: Record<string, string> = {};

  for (const rawLine of match[1].split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf(":");

    if (separatorIndex <= 0) {
      return null;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    fields[key] = value;
  }

  return fields;
}

function validateSkillFrontmatter(content: string, filePath: string): string[] {
  const frontmatter = parseSkillFrontmatter(content);

  if (!frontmatter) {
    return [`Missing or invalid skill frontmatter: ${filePath}`];
  }

  const errors: string[] = [];

  if (!frontmatter.name) {
    errors.push(`Skill frontmatter is missing name: ${filePath}`);
  }

  if (!frontmatter.description) {
    errors.push(`Skill frontmatter is missing description: ${filePath}`);
  }

  return errors;
}

async function listActiveWorkFiles(cwd: string): Promise<string[]> {
  try {
    const entries = await readdir(path.join(cwd, "docs", "work", "active"), {
      withFileTypes: true
    });

    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => path.posix.join("docs", "work", "active", entry.name))
      .sort();
  } catch {
    return [];
  }
}

function validateContextBudgets(
  contents: Map<string, string>,
  budgetManifest: ContextBudgetManifest
): string[] {
  return budgetManifest.entries
    .flatMap((entry) => {
      if (entry.maxLines === null) {
        return [];
      }

      const content = contents.get(entry.filePath);

      if (!content) {
        return [];
      }

      const lines = countLines(content);

      if (lines <= entry.maxLines) {
        return [];
      }

      return [
        `Context budget warning: ${entry.filePath} is ${lines} lines (budget ${entry.maxLines}). Split or trim this file to reduce startup context.`
      ];
    })
    .sort();
}

export async function runDoctor(options: {
  cwd: string;
}): Promise<{
  ok: boolean;
  errors: string[];
  warnings: string[];
  repairCommands: string[];
}> {
  const cwd = await detectRepositoryRoot(options.cwd);
  const errors: string[] = [];
  const warnings: string[] = [];
  const repairCommands = new Set<string>();
  const observedContents = new Map<string, string>();
  let manifest: ReturnType<typeof parseManifest> | null = null;
  let contextBudgetManifest: ContextBudgetManifest = buildContextBudgetManifest(requiredBaseFiles);
  let providerProjectionManifest: ProviderProjectionManifest = buildProviderProjectionManifest();
  let registry = loadProfileRegistry({
    version: PROFILE_REGISTRY_MIGRATION_TARGET,
    axes: {
      phase: {},
      frontend: {},
      backend: {},
      systemType: {},
      architectureStyle: {},
      quality: {},
      practice: {},
      constraints: {}
    }
  }).registry;

  try {
    const registryContents = await readFile(resolveProfileRegistryPath(cwd), "utf8");
    const loadedRegistry = loadProfileRegistry(JSON.parse(registryContents));
    registry = loadedRegistry.registry;

    if (loadedRegistry.needsRewrite && loadedRegistry.migratedFrom) {
      warnings.push(
        `Profile registry rewrite recommended: ${loadedRegistry.migratedFrom} -> ${PROFILE_REGISTRY_MIGRATION_TARGET}`
      );
      repairCommands.add(`fortheagent sync --cwd ${cwd}`);
    }

    for (const error of validateProfileRegistry(registry)) {
      errors.push(error);
    }
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;

    if (maybeNodeError.code === "ENOENT") {
      errors.push("Missing required file: .agent-foundation/profile-registry.json");
      repairCommands.add(`fortheagent sync --cwd ${cwd}`);
    } else {
      errors.push("Invalid profile registry: .agent-foundation/profile-registry.json");
      repairCommands.add(`fortheagent sync --cwd ${cwd}`);
  }
}

function validateConstraintCoverage(options: {
  manifest: NonNullable<ReturnType<typeof parseManifest>>;
  contents: Map<string, string>;
}): string[] {
  const warnings: string[] = [];
  const verification = (options.contents.get("docs/engineering/verification.md") ?? "").toLowerCase();
  const runbooks = (options.contents.get("docs/operations/runbooks.md") ?? "").toLowerCase();
  const commandRegistry = (
    options.contents.get("docs/engineering/command-registry.md") ?? ""
  ).toLowerCase();

  if (options.manifest.constraints.includes("auth")) {
    const hasAuthVerification =
      verification.includes("role") ||
      verification.includes("permission") ||
      verification.includes("authorization") ||
      verification.includes("session");
    const hasAuthReviewHook =
      commandRegistry.includes("review:") &&
      (commandRegistry.includes("auth") || commandRegistry.includes("permission"));

    if (!hasAuthVerification) {
      warnings.push(
        "Constraint coverage warning: auth is selected but docs/engineering/verification.md does not describe role, permission, or session evidence"
      );
    }

    if (!hasAuthReviewHook) {
      warnings.push(
        "Constraint coverage warning: auth is selected but docs/engineering/command-registry.md does not name an auth-focused review or verification expectation"
      );
    }
  }

  if (options.manifest.constraints.includes("realtime")) {
    const hasRealtimeVerification =
      verification.includes("reconnect") ||
      verification.includes("ordering") ||
      verification.includes("presence") ||
      verification.includes("degraded-network");
    const hasRealtimeRunbook =
      runbooks.includes("realtime") ||
      runbooks.includes("reconnect") ||
      runbooks.includes("socket.io") ||
      runbooks.includes("degraded network");

    if (!hasRealtimeVerification) {
      warnings.push(
        "Constraint coverage warning: realtime is selected but docs/engineering/verification.md does not describe reconnect, ordering, or presence evidence"
      );
    }

    if (!hasRealtimeRunbook) {
      warnings.push(
        "Constraint coverage warning: realtime is selected but docs/operations/runbooks.md does not include a realtime incident draft"
      );
    }
  }

  return warnings;
}

  try {
    const manifestContents = await readFile(resolveManifestPath(cwd), "utf8");
    manifest = applyDefaultWorkflowState(parseManifest(JSON.parse(manifestContents)));
    for (const error of validateManifest(manifest, registry)) {
      errors.push(error);
    }
    for (
      const error of await validateProfileRegistryTemplates(
        collectExpectedTemplateRoots(manifest, registry)
      )
    ) {
      errors.push(error);
    }
  } catch (error) {
    const maybeNodeError = error as NodeJS.ErrnoException;

    if (maybeNodeError.code === "ENOENT") {
      errors.push("Missing required file: .agent-foundation/manifest.json");
    } else {
      errors.push("Invalid manifest: .agent-foundation/manifest.json");
    }
  }

  try {
    const budgetContents = await readFile(
      path.join(cwd, ".agent-foundation", "context-budget.json"),
      "utf8"
    );
    contextBudgetManifest = JSON.parse(budgetContents) as ContextBudgetManifest;
  } catch {
    errors.push("Missing required file: .agent-foundation/context-budget.json");
    repairCommands.add(`fortheagent sync --cwd ${cwd}`);
  }

  try {
    const projectionContents = await readFile(
      path.join(cwd, ".agent-foundation", "provider-projections.json"),
      "utf8"
    );
    providerProjectionManifest = JSON.parse(projectionContents) as ProviderProjectionManifest;
  } catch {
    errors.push("Missing required file: .agent-foundation/provider-projections.json");
    repairCommands.add(`fortheagent sync --cwd ${cwd}`);
  }

  const desiredFiles = manifest
    ? await buildDesiredFileContents({
        cwd,
        manifest,
        registry
      })
    : null;
  const scan = manifest ? await scanRepository(cwd) : null;
  const requiredFiles = unique([
    ...requiredBaseFiles,
    ...(manifest ? collectExpectedOutputs(manifest, registry) : []),
    ...(desiredFiles ? [...desiredFiles.keys()] : [])
  ]);

  for (const requiredFile of requiredFiles) {
    try {
      await access(path.join(cwd, requiredFile));
      const content = await readFile(path.join(cwd, requiredFile), "utf8");
      observedContents.set(requiredFile, content);

      if (classifyFile(requiredFile) === "merge-managed") {
        if (!hasValidManagedMarkers(content)) {
          errors.push(`Corrupted managed markers: ${requiredFile}`);
          repairCommands.add(`fortheagent sync --repair --cwd ${cwd}`);
        }
      }

      if (
        desiredFiles &&
        classifyFile(requiredFile) === "managed" &&
        desiredFiles.has(requiredFile) &&
        content !== desiredFiles.get(requiredFile)
      ) {
        errors.push(`Managed file drift detected: ${requiredFile}`);
        repairCommands.add(`fortheagent sync --cwd ${cwd}`);
      }

      if (isDocFrontmatterFile(requiredFile)) {
        const frontmatterValidation = validateFrontmatter(content, requiredFile);

        for (const error of frontmatterValidation.errors) {
          errors.push(error);
          repairCommands.add(`fortheagent sync --cwd ${cwd}`);
        }

        for (const warning of frontmatterValidation.warnings) {
          warnings.push(warning);
        }
      }

      if (requiredFile.startsWith(".agents/skills/") && requiredFile.endsWith("/SKILL.md")) {
        for (const error of validateSkillFrontmatter(content, requiredFile)) {
          errors.push(error);
          repairCommands.add(`fortheagent sync --cwd ${cwd}`);
        }
      }
    } catch {
      errors.push(`Missing required file: ${requiredFile}`);
      repairCommands.add(`fortheagent sync --cwd ${cwd}`);
    }
  }

  for (const error of validateProjectionParity(observedContents, providerProjectionManifest)) {
    errors.push(error);
    repairCommands.add(`fortheagent sync --cwd ${cwd}`);
  }

  const expectedOutputs = manifest ? collectExpectedOutputs(manifest, registry) : [];

  if (manifest && scan) {
    if (scan.phaseRecommendation !== manifest.projectPhase) {
      warnings.push(
        `Project phase mismatch warning: scan recommends ${scan.phaseRecommendation} but manifest is ${manifest.projectPhase}`
      );
    }

    const computedDocIndex = buildDocIndexManifest({
      version: manifest.version,
      filePaths: observedContents.keys(),
      manifest,
      scan
    });
    const computedDocHealth = buildDocHealthManifest({
      version: manifest.version,
      manifest,
      docIndex: computedDocIndex,
      contents: observedContents
    });
    const brokenRelatedDocWarnings = new Set<string>();

    for (const [filePath, content] of observedContents.entries()) {
      if (!isDocFrontmatterFile(filePath)) {
        continue;
      }

      const frontmatter = parseDocFrontmatter(content);

      if (!frontmatter || !Array.isArray(frontmatter.related_docs)) {
        continue;
      }

      for (const relatedDoc of frontmatter.related_docs) {
        if (!observedContents.has(relatedDoc)) {
          brokenRelatedDocWarnings.add(
            `Broken related_docs reference: ${filePath} -> ${relatedDoc}`
          );
        }
      }
    }

    for (const entry of computedDocIndex.entries) {
      for (const relatedDoc of entry.relatedDocs) {
        if (!observedContents.has(relatedDoc)) {
          brokenRelatedDocWarnings.add(
            `Broken related_docs reference: ${entry.path} -> ${relatedDoc}`
          );
          repairCommands.add(`fortheagent sync --cwd ${cwd}`);
        }
      }
    }

    warnings.push(...brokenRelatedDocWarnings);

    for (const entry of computedDocHealth.entries) {
      if (entry.stale) {
        warnings.push(`Document freshness warning: ${entry.path} is stale`);
      }

      if (entry.orphaned) {
        warnings.push(
          `Document reachability warning: ${entry.path} is not reachable from startup docs`
        );
      }
    }

    const activeWorkFiles = await listActiveWorkFiles(cwd);
    const normalizedActiveWorkItem = resolveActiveWorkItemPath(manifest);

    if (normalizedActiveWorkItem && !activeWorkFiles.includes(normalizedActiveWorkItem)) {
      errors.push(
        `Workflow state mismatch: activeWorkItem points to missing file ${normalizedActiveWorkItem}`
      );
      repairCommands.add(`fortheagent sync --cwd ${cwd}`);
    }

    if (!normalizedActiveWorkItem && activeWorkFiles.length > 0) {
      warnings.push(
        `Workflow state warning: ${activeWorkFiles.length} active work file(s) exist but manifest.workflowState.activeWorkItem is empty`
      );
    }

    const commandRegistry = observedContents.get("docs/engineering/command-registry.md") ?? "";
    if (!commandRegistry.includes("Test:")) {
      warnings.push(
        "Command registry warning: docs/engineering/command-registry.md is missing a Test entry"
      );
    }
    if (!commandRegistry.includes("Review:")) {
      warnings.push(
        "Command registry warning: docs/engineering/command-registry.md is missing a Review entry"
      );
    }

    for (const warning of validateConstraintCoverage({ manifest, contents: observedContents })) {
      warnings.push(warning);
    }
  }

  for (const overlayFile of collectKnownOverlayOutputs(registry)) {
    if (expectedOutputs.includes(overlayFile)) {
      continue;
    }

    try {
      await access(path.join(cwd, overlayFile));

      if (classifyFile(overlayFile) === "merge-managed") {
        warnings.push(`Unexpected merge-managed overlay file present: ${overlayFile}`);
      } else {
        warnings.push(`Unexpected managed overlay file present: ${overlayFile}`);
        repairCommands.add(`fortheagent sync --prune --cwd ${cwd}`);
      }
    } catch {
      continue;
    }
  }

  for (const warning of validateContextBudgets(observedContents, contextBudgetManifest)) {
    warnings.push(warning);
  }

  for (const warning of validateAlwaysLoadedSurface(observedContents)) {
    warnings.push(warning);
  }

  for (const warning of collectDuplicateGuidanceWarnings(observedContents)) {
    warnings.push(warning);
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: Array.from(new Set(warnings)).sort(),
    repairCommands: Array.from(repairCommands).sort()
  };
}

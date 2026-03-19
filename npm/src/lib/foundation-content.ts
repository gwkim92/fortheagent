import path from "node:path";
import type { Manifest } from "./manifest.js";
import { classifyFile } from "./file-ownership.js";
import type { RepositoryScan, SubtreeScan } from "./repo-scan.js";
import {
  buildInitialDecisionDocPath,
  resolveActiveWorkItemPath
} from "./workflow-state.js";

type FoundationContext = {
  manifest: Manifest;
  scan: RepositoryScan;
};

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function toBulletList(values: string[], empty = "- none recorded yet"): string {
  const normalized = unique(values);
  return normalized.length > 0 ? normalized.map((value) => `- ${value}`).join("\n") : empty;
}

function toNumberedList(values: string[]): string {
  return values.map((value, index) => `${index + 1}. ${value}`).join("\n");
}

function code(value: string): string {
  return `\`${value}\``;
}

function titleCaseFromSlug(value: string): string {
  return value
    .split(/[-_]+/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function buildActiveWorkItemHeading(repositoryPath: string, manifest: Manifest): string {
  if (repositoryPath === "docs/work/active/0001-repository-baseline-and-target.md") {
    return "Active Work Item: Repository Baseline and Target";
  }

  if (repositoryPath === "docs/work/active/0001-initial-design-scope.md") {
    return "Active Work Item: Initial Design Scope";
  }

  const fileName = path.posix.basename(repositoryPath, ".md").replace(/^\d+-/, "");
  const title = titleCaseFromSlug(fileName);

  if (title) {
    return `Active Work Item: ${title}`;
  }

  return manifest.projectPhase === "existing"
    ? "Active Work Item: Repository Follow-Up"
    : "Active Work Item: Design Follow-Up";
}

function buildActiveWorkItemObjective(manifest: Manifest, repositoryPath: string): string {
  if (repositoryPath === "docs/work/active/0001-repository-baseline-and-target.md") {
    return "Confirm the current repository baseline, define the intended target boundary, and establish the first credible migration slice.";
  }

  if (repositoryPath === "docs/work/active/0001-initial-design-scope.md") {
    return "Turn the selected stack, product context, and constraints into a concrete design scope that implementation can follow.";
  }

  return manifest.projectPhase === "existing"
    ? "Advance this repository-improvement slice without losing current-state facts, migration guardrails, or verification evidence."
    : "Advance this scoped design or implementation slice while keeping the generated contract, decisions, and verification notes aligned.";
}

function buildActiveWorkItemDeliverables(
  manifest: Manifest,
  repositoryPath: string
): string[] {
  if (repositoryPath === "docs/work/active/0001-repository-baseline-and-target.md") {
    return [
      "Confirm current-state facts, the target-state boundary, and the migration sequence that should happen first.",
      "Tie known pain points and stability constraints to specific architecture and delivery decisions.",
      "Leave clear next steps for the first implementation or review slice."
    ];
  }

  if (repositoryPath === "docs/work/active/0001-initial-design-scope.md") {
    return [
      "Confirm the initial problem framing, architecture boundary, and verification expectations.",
      "Turn selected constraints and practices into concrete design decisions.",
      "Leave clear next steps for the first implementation or review slice."
    ];
  }

  return manifest.projectPhase === "existing"
    ? [
        "Name the repository facts, target boundary, and change slice this work item covers.",
        "Record the concrete checks needed before and after touching code or docs.",
        "Leave the next agent with explicit next steps, blockers, and open decisions."
      ]
    : [
        "State the scope boundary, expected outputs, and verification path for this slice.",
        "Tie the slice back to the selected stack, product context, and active constraints.",
        "Leave the next agent with explicit next steps, blockers, and open decisions."
      ];
}

function relativeFileList(values: string[]): string[] {
  return unique(values).map((value) => code(value));
}

function buildSelectionFacts(context: FoundationContext): string[] {
  const { manifest } = context;
  const facts: string[] = [];

  facts.push(`Foundation status: ${manifest.status}.`);
  facts.push(`Project phase: ${manifest.projectPhase}.`);

  if (manifest.frontend) {
    facts.push(`Frontend profile: ${manifest.frontend}.`);
  }

  if (manifest.backend) {
    facts.push(`Backend profile: ${manifest.backend}.`);
  }

  if (manifest.systemType) {
    facts.push(`Project type: ${manifest.systemType}.`);
  }

  if (manifest.architectureStyle) {
    facts.push(`Architecture style: ${manifest.architectureStyle}.`);
  }

  if (manifest.constraints.length > 0) {
    facts.push(`Active constraints: ${manifest.constraints.join(", ")}.`);
  }

  if (manifest.practiceProfiles.length > 0) {
    facts.push(`Active practice profiles: ${manifest.practiceProfiles.join(", ")}.`);
  }

  if (manifest.qualityProfiles.length > 0) {
    facts.push(`Active quality profiles: ${manifest.qualityProfiles.join(", ")}.`);
  }

  return facts;
}

function buildActiveConstraintDocLinks(manifest: Manifest): string[] {
  return manifest.constraints.map((constraint) => code(`docs/product/constraints/${constraint}.md`));
}

function buildActivePracticeDocLinks(manifest: Manifest): string[] {
  return manifest.practiceProfiles.map((practice) => code(`docs/practices/${practice}.md`));
}

function buildActiveProfileDocLinks(manifest: Manifest): string[] {
  return [
    manifest.frontend && manifest.frontend !== "none" ? code("docs/architecture/frontend.md") : null,
    manifest.backend && manifest.backend !== "none" ? code("docs/architecture/backend.md") : null,
    manifest.systemType ? code("docs/system/overview.md") : null
  ].filter((value): value is string => value !== null);
}

function buildScanFacts(scan: RepositoryScan): string[] {
  const facts: string[] = [
    "Repository root: current workspace root (`.`).",
    `Package manager: ${scan.packageManager}.`,
    `Automation install command: ${scan.installCommand}.`,
    `Workspace layout: ${scan.workspaceLayout}.`
  ];

  if (scan.packageName) {
    facts.push(`Package name: ${scan.packageName}.`);
  }

  if (scan.frontendHints.length > 0) {
    facts.push(`Frontend hints from scan: ${scan.frontendHints.join(", ")}.`);
  }

  if (scan.backendHints.length > 0) {
    facts.push(`Backend hints from scan: ${scan.backendHints.join(", ")}.`);
  }

  if (scan.routeHints.length > 0) {
    facts.push(`Route structure detected in: ${scan.routeHints.join(", ")}.`);
  }

  if (scan.apiHints.length > 0) {
    facts.push(`API-related directories detected in: ${scan.apiHints.join(", ")}.`);
  }

  if (scan.dataHints.length > 0) {
    facts.push(`Data layer hints: ${scan.dataHints.join(", ")}.`);
  }

  if (scan.realtimeToolHints.length > 0) {
    facts.push(`Realtime tooling hints: ${scan.realtimeToolHints.join(", ")}.`);
  }

  if (scan.dataToolHints.length > 0) {
    facts.push(`Data tooling hints: ${scan.dataToolHints.join(", ")}.`);
  }

  if (scan.testHints.length > 0) {
    facts.push(`Testing and validation hints: ${scan.testHints.join(", ")}.`);
  }

  if (scan.ciFiles.length > 0) {
    facts.push(`Existing CI workflows: ${scan.ciFiles.join(", ")}.`);
  }

  if (scan.systemTypeHints.length > 0) {
    facts.push(`System type hints from scan: ${scan.systemTypeHints.join(", ")}.`);
  }

  if (scan.architectureStyleHints.length > 0) {
    facts.push(
      `Architecture style hints from scan: ${scan.architectureStyleHints.join(", ")}.`
    );
  }

  facts.push(`Phase recommendation from scan: ${scan.phaseRecommendation}.`);

  if (scan.phaseRecommendationReasons.length > 0) {
    facts.push(`Phase recommendation reasons: ${scan.phaseRecommendationReasons.join(", ")}.`);
  }

  return facts;
}

function buildEngineeringSignals(scan: RepositoryScan): string[] {
  const facts: string[] = [];

  if (Object.keys(scan.scripts).length > 0) {
    facts.push(
      `Meaningful package scripts: ${Object.entries(scan.scripts)
        .map(([name, script]) => `${name} -> ${script}`)
        .join("; ")}.`
    );
  }

  if (scan.routeHints.length > 0) {
    facts.push(`Route surfaces already present: ${scan.routeHints.join(", ")}.`);
  }

  if (scan.apiHints.length > 0) {
    facts.push(`API surfaces already present: ${scan.apiHints.join(", ")}.`);
  }

  if (scan.dataHints.length > 0) {
    facts.push(`Data-related surfaces already present: ${scan.dataHints.join(", ")}.`);
  }

  if (scan.realtimeToolHints.length > 0) {
    facts.push(`Realtime surfaces already present: ${scan.realtimeToolHints.join(", ")}.`);
  }

  if (scan.testHints.length > 0) {
    facts.push(`Current validation signals: ${scan.testHints.join(", ")}.`);
  }

  if (scan.ciFiles.length > 0) {
    facts.push(`Existing workflow files: ${scan.ciFiles.join(", ")}.`);
  }

  if (scan.existingDocs.length > 0) {
    facts.push(`Existing docs under docs/: ${scan.existingDocs.join(", ")}.`);
  }

  return facts;
}

function buildOpenQuestionList(context: FoundationContext, extras: string[] = []): string[] {
  const { manifest } = context;
  const questions = [...extras];

  if (!manifest.projectContext.primaryProduct) {
    questions.push("What is the primary user problem this repository should solve?");
  }

  if (manifest.projectContext.targetUsers.length === 0) {
    questions.push("Who are the target users or operators for this system?");
  }

  if (manifest.projectContext.coreEntities.length === 0) {
    questions.push("What are the core domain entities, records, or resources?");
  }

  if (manifest.projectContext.criticalRisks.length === 0) {
    questions.push("What failure modes, compliance risks, or operational risks matter most?");
  }

  if (manifest.projectContext.deliveryPriorities.length === 0) {
    questions.push("What delivery priorities should shape the first design pass?");
  }

  if (
    manifest.projectPhase === "existing" &&
    manifest.projectContext.currentPainPoints.length === 0
  ) {
    questions.push("What pain points or debt areas in the current repository are driving this work?");
  }

  if (
    manifest.projectPhase === "existing" &&
    manifest.projectContext.stabilityConstraints.length === 0
  ) {
    questions.push("What must remain stable while this repository is being refactored or adopted?");
  }

  return unique(questions);
}

function buildAssumptions(context: FoundationContext, extras: string[] = []): string[] {
  return unique(extras);
}

function buildRequiredOutputs(_context: FoundationContext, extras: string[] = []): string[] {
  return unique(extras);
}

function renderManagedBlock(section: string, body: string): string {
  return [
    `<!-- agent-foundation:begin section="${section}" -->`,
    body.trim(),
    `<!-- agent-foundation:end section="${section}" -->`
  ].join("\n");
}

function renderStructuredBody(
  context: FoundationContext,
  options: {
    confirmedFacts: string[];
    workingAssumptions?: string[];
    openQuestions?: string[];
    requiredOutputs?: string[];
  }
): string {
  return [
    "## Confirmed facts",
    toBulletList(options.confirmedFacts),
    "",
    "## Working assumptions",
    toBulletList(options.workingAssumptions ?? []),
    "",
    "## Open questions",
    toBulletList(options.openQuestions ?? buildOpenQuestionList(context)),
    "",
    "## Required outputs",
    toBulletList(options.requiredOutputs ?? [])
  ].join("\n");
}

function renderMergeManagedDocument(
  title: string,
  section: string,
  body: string,
  notesHeading = "## Working notes"
): string {
  return [
    `# ${title}`,
    "",
    renderManagedBlock(section, body),
    "",
    notesHeading,
    "Add project-specific design notes below this line. `sync` preserves content outside managed blocks."
  ].join("\n");
}

function renderManagedDocument(title: string, body: string): string {
  return [`# ${title}`, "", body.trim(), ""].join("\n");
}

function renderSubtreeAdapter(options: {
  provider: "codex" | "claude" | "gemini";
  rootPath: string;
  areaDocPath: string;
}): string {
  const heading =
    options.provider === "codex"
      ? "Agent Area Entry"
      : options.provider === "claude"
        ? "Claude Area Entry"
        : "Gemini Area Entry";
  const startupLines =
    options.provider === "claude"
      ? [
          "Use this subtree context first:",
          "",
          `@${options.areaDocPath}`,
          "@docs/engineering/command-registry.md",
          "",
          "Load broader repository docs only if this subtree task cannot be resolved locally."
        ]
      : [
          "Use this subtree context first:",
          "",
          `- \`${options.areaDocPath}\``,
          "- `docs/engineering/command-registry.md`",
          "",
          "Load broader repository docs only if this subtree task cannot be resolved locally."
        ];

  return [
    `# ${heading}`,
    "",
    renderManagedBlock(
      "subtree-startup",
      [
        `Scoped root: \`${options.rootPath}\``,
        "",
        ...startupLines
      ].join("\n")
    ),
    "",
    "## Local Notes",
    "Add area-specific notes below this line. `sync` preserves content outside managed blocks.",
    ""
  ].join("\n");
}

function buildVerificationCommandBullets(scan: RepositoryScan): string[] {
  const commands: string[] = [];

  if (Object.keys(scan.scripts).length > 0) {
    for (const [name, script] of Object.entries(scan.scripts)) {
      commands.push(`Script \`${name}\`: \`${script}\`.`);
    }
  }

  if (commands.length === 0) {
    commands.push(`Install baseline dependencies with ${code(scan.installCommand)}.`);
    commands.push("Document the first real verification command as soon as scripts exist.");
  }

  return commands;
}

function buildRunCommand(
  packageManager: RepositoryScan["packageManager"],
  scriptName: string
): string {
  switch (packageManager) {
    case "pnpm":
      return `pnpm ${scriptName}`;
    case "yarn":
      return `yarn ${scriptName}`;
    case "bun":
      return `bun run ${scriptName}`;
    default:
      return scriptName === "test" ? "npm test" : `npm run ${scriptName}`;
  }
}

function buildScopedRunCommand(
  packageManager: RepositoryScan["packageManager"],
  rootPath: string,
  scriptName: string
): string {
  return `cd ${rootPath} && ${buildRunCommand(packageManager, scriptName)}`;
}

function findSubtreeScan(scan: RepositoryScan, rootPath: string): SubtreeScan | null {
  return scan.subtrees.find((subtree) => subtree.root === rootPath) ?? null;
}

function buildCommandRegistryExpectedOutcomes(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outcomes = [
    `Install should complete with ${code(scan.installCommand)} and leave the repository ready for the next validation command.`,
    "Test commands should exit successfully for the touched surface before major implementation claims are accepted.",
    "Build commands should complete without type, schema, or contract regressions on the touched surface.",
    `Review should end with ${code("fortheagent doctor")} or the matching CLI doctor command reporting a healthy repository.`
  ];

  if (manifest.constraints.includes("auth")) {
    outcomes.push(
      "Auth-sensitive changes should include explicit evidence for roles, permissions, session scope, and forbidden-path behavior."
    );
  }

  if (manifest.constraints.includes("realtime")) {
    outcomes.push(
      "Realtime-sensitive changes should include evidence for reconnect, ordering, duplicate-delivery, and degraded-network behavior."
    );
  }

  return unique(outcomes);
}

function buildSubtreeCommandBullets(scan: RepositoryScan): string[] {
  return scan.subtrees.flatMap((subtree) => {
    const bullets: string[] = [];
    const label = subtree.packageName ? `${subtree.root} (${subtree.packageName})` : subtree.root;

    if (subtree.scripts.dev) {
      bullets.push(`${label}: dev via ${code(buildScopedRunCommand(scan.packageManager, subtree.root, "dev"))}.`);
    }

    if (subtree.scripts.test) {
      bullets.push(`${label}: test via ${code(buildScopedRunCommand(scan.packageManager, subtree.root, "test"))}.`);
    }

    if (subtree.scripts.build) {
      bullets.push(`${label}: build via ${code(buildScopedRunCommand(scan.packageManager, subtree.root, "build"))}.`);
    }

    if (subtree.routeHints.length > 0) {
      bullets.push(`${label}: route surfaces ${subtree.routeHints.join(", ")}.`);
    }

    if (subtree.apiHints.length > 0) {
      bullets.push(`${label}: API surfaces ${subtree.apiHints.join(", ")}.`);
    }

    if (subtree.realtimeToolHints.length > 0) {
      bullets.push(`${label}: realtime tooling ${subtree.realtimeToolHints.join(", ")}.`);
    }

    return bullets;
  });
}

function buildDebugCommand(scan: RepositoryScan): string {
  for (const subtree of scan.subtrees) {
    if (subtree.scripts.test) {
      return buildScopedRunCommand(scan.packageManager, subtree.root, "test");
    }

    if (subtree.scripts.build) {
      return buildScopedRunCommand(scan.packageManager, subtree.root, "build");
    }

    if (subtree.scripts.dev) {
      return buildScopedRunCommand(scan.packageManager, subtree.root, "dev");
    }
  }

  if (scan.scripts.test) {
    return buildRunCommand(scan.packageManager, "test");
  }

  if (scan.scripts.build) {
    return buildRunCommand(scan.packageManager, "build");
  }

  return scan.installCommand;
}

function buildRunbookDraftBullets(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const bullets: string[] = [];

  if (scan.scripts.test) {
    bullets.push(`Broken tests: rerun ${code(buildRunCommand(scan.packageManager, "test"))} first, then narrow to the smallest failing subtree command.`);
  }

  if (scan.scripts.build) {
    bullets.push(`Build or integration failures: rerun ${code(buildRunCommand(scan.packageManager, "build"))} and compare the failure against the last healthy handoff and current scripts.`);
  }

  if (scan.ciFiles.length > 0) {
    bullets.push(`Release or CI failures: inspect ${relativeFileList(scan.ciFiles).join(", ")} and replay the nearest local build or test command before changing workflow files.`);
  }

  if (manifest.constraints.includes("auth")) {
    bullets.push(
      "Auth regressions: verify changed roles, permission checks, session scope, and the first forbidden-path scenario before rollout."
    );
  }

  if (manifest.constraints.includes("realtime")) {
    bullets.push(
      `Realtime incidents: confirm reconnect, ordering, duplicate-delivery, and degraded-network behavior on the smallest live surface${scan.realtimeToolHints.length > 0 ? ` (${scan.realtimeToolHints.join(", ")})` : ""}.`
    );
  }

  if (bullets.length === 0) {
    bullets.push(
      "Capture the first responder path for the highest-risk failure mode once real scripts, environments, or release steps exist."
    );
  }

  return bullets;
}

function buildInitialDecisionTitle(manifest: Manifest): string {
  return manifest.projectPhase === "existing"
    ? "ADR-0001 Repository Baseline"
    : "ADR-0001 Foundation Baseline";
}

function renderCursorRule(
  description: string,
  bodyLines: string[],
  globs: string[] = []
): string {
  const metadata = [
    "---",
    `description: ${description}`,
    ...(globs.length > 0 ? ["globs:", ...globs.map((glob) => `  - ${glob}`)] : []),
    "alwaysApply: false",
    "---"
  ];

  return [...metadata, "", ...bodyLines, ""].join("\n");
}

function buildConstraintImplications(context: FoundationContext, constraint: string): string[] {
  switch (constraint) {
    case "payments":
      return [
        "Payment and billing flows are explicitly in scope.",
        "Design should call out charging boundaries, reconciliation, retries, and audit visibility.",
        "Testing should cover success, failure, retry, webhook, and ledger-sensitive scenarios."
      ];
    case "auth":
      return [
        "Authentication and authorization are first-order design concerns.",
        "Design should name trust boundaries, role rules, and access checks."
      ];
    case "pii":
      return [
        "The system stores or processes personal data.",
        "Design should identify data minimization, retention, and access control expectations."
      ];
    case "multi-tenant":
      return [
        "Multiple customers or workspaces must remain isolated.",
        "Design should explain tenancy boundaries in data, auth, and operations."
      ];
    case "offline":
      return [
        "Some workflows must survive poor or missing connectivity.",
        "Design should identify local state, sync strategy, and conflict handling."
      ];
    case "realtime":
      return [
        "Users expect live state changes or instant synchronization.",
        "Design should explain subscriptions, event flow, and eventual consistency tradeoffs."
      ];
    case "seo":
      return [
        "Search discoverability materially affects the product.",
        "Design should explain rendering, metadata, and content indexing implications."
      ];
    default:
      return buildAssumptions(context);
  }
}

function buildFrontendProfileImplications(frontend: string | null): string[] {
  switch (frontend) {
    case "next":
      return [
        "The frontend should assume App Router-style route segments and explicit Server/Client Component boundaries.",
        "Design should name Suspense or loading boundaries, cache or revalidation behavior, and mutation flow through route handlers or server-side actions."
      ];
    case "react-spa":
      return [
        "The selected frontend profile currently suggests a client-rendered single-page app.",
        "Design should name routing, API cache boundaries, client state ownership, and where derived data avoids effect-heavy coordination."
      ];
    case "none":
      return ["This repository does not own a user-facing frontend application."];
    default:
      return [];
  }
}

function buildBackendProfileImplications(backend: string | null): string[] {
  switch (backend) {
    case "nest":
      return [
        "The selected backend profile currently suggests Nest modules, providers, and controllers as the main application graph.",
        "Design should keep controllers thin, push orchestration into providers, and align domain or service boundaries with exported module interfaces."
      ];
    case "fastify":
      return [
        "The selected backend profile currently suggests Fastify route handlers, plugin encapsulation, and schema-driven request or response contracts.",
        "Design should keep validation, serialization, and service boundaries explicit and leave room for type providers or OpenAPI generation."
      ];
    case "serverless":
      return [
        "The selected backend profile currently suggests request or event-driven functions with stateless execution.",
        "Design should call out idempotency, cold-start sensitivity, queue or event contracts, and retry-safe integration boundaries."
      ];
    case "none":
      return ["This repository does not own a dedicated backend service or API."];
    default:
      return [];
  }
}

function buildSystemTypeImplications(systemType: string | null): string[] {
  switch (systemType) {
    case "internal-tool":
      return [
        "Primary value likely comes from operator efficiency, accuracy, or workflow visibility.",
        "Design should make operational workflows, permissions, and auditability explicit."
      ];
    case "b2b-saas":
      return [
        "The product likely serves external customer organizations and account-level workflows.",
        "Design should make tenancy, admin concerns, onboarding, and customer isolation explicit."
      ];
    case "content-site":
      return [
        "Publishing flow, discoverability, and content modeling are likely first-order concerns.",
        "Design should make editorial workflow, metadata, and delivery performance explicit."
      ];
    case "api-platform":
      return [
        "External or internal API consumers are likely the main product surface.",
        "Design should make API contracts, versioning, auth, and operational guarantees explicit."
      ];
    case "realtime-app":
      return [
        "Live collaboration or fast state propagation is likely central to the product.",
        "Design should make event flow, presence, subscriptions, and consistency tradeoffs explicit."
      ];
    case "data-platform":
      return [
        "Data ingestion, processing, lineage, or analytics are likely core system concerns.",
        "Design should make pipelines, storage boundaries, and data quality controls explicit."
      ];
    default:
      return [];
  }
}

function buildArchitectureStyleImplications(style: string | null): string[] {
  switch (style) {
    case "monolith":
      return [
        "A single deployable unit is acceptable, but internal boundaries still need to be named.",
        "Design should explain how coupling stays manageable inside one runtime."
      ];
    case "modular-monolith":
      return [
        "The selected architecture currently suggests one deployable app, with explicit and enforceable module boundaries.",
        "Design should explain module seams, ownership, and change isolation."
      ];
    case "service-oriented":
      return [
        "The selected architecture currently suggests multiple services with explicit contracts.",
        "Design should explain service boundaries, data ownership, and operational coupling."
      ];
    case "event-driven":
      return [
        "The selected architecture currently suggests asynchronous coordination as a major design tool.",
        "Design should explain event contracts, idempotency, and failure handling."
      ];
    default:
      return [];
  }
}

function buildFrontendRequiredOutputs(frontend: string | null): string[] {
  switch (frontend) {
    case "next":
      return [
        "Document route-segment ownership, Server/Client Component boundaries, cache or revalidation strategy, and loading or error states."
      ];
    case "react-spa":
      return [
        "Document router ownership, API cache strategy, client state boundaries, and how the UI avoids unnecessary effect-driven synchronization."
      ];
    case "none":
      return ["Document why this repository does not own a user-facing frontend surface."];
    default:
      return [
        "Document rendering model, routing, data loading boundaries, and UI state ownership."
      ];
  }
}

function buildBackendRequiredOutputs(backend: string | null): string[] {
  switch (backend) {
    case "nest":
      return [
        "Document module boundaries, provider ownership, controller responsibilities, and integration or operational seams."
      ];
    case "fastify":
      return [
        "Document plugin boundaries, schema ownership, request or response contracts, and operational integration seams."
      ];
    case "serverless":
      return [
        "Document function boundaries, trigger contracts, retry or idempotency rules, and downstream integration responsibilities."
      ];
    case "none":
      return ["Document why this repository does not own a dedicated backend service or API."];
    default:
      return [
        "Document service boundaries, integration responsibilities, and operational concerns."
      ];
  }
}

function buildSystemRequiredOutputs(systemType: string | null): string[] {
  switch (systemType) {
    case "internal-tool":
      return [
        "Describe operator workflows, permission-sensitive actions, audit expectations, and where accuracy or throughput matters most."
      ];
    case "b2b-saas":
      return [
        "Describe customer account boundaries, tenancy expectations, onboarding or admin flows, and where customer isolation can fail."
      ];
    case "content-site":
      return [
        "Describe publishing workflow, content modeling, metadata ownership, and how delivery or discoverability will be protected."
      ];
    case "api-platform":
      return [
        "Describe API product boundaries, versioning expectations, auth posture, and the reliability guarantees expected by consumers."
      ];
    case "realtime-app":
      return [
        "Describe collaboration model, event or subscription flow, consistency tradeoffs, and reconnect or presence expectations."
      ];
    case "data-platform":
      return [
        "Describe ingestion boundaries, processing stages, data lineage, backfill strategy, and where quality controls must exist."
      ];
    default:
      return [
        "Describe the operating model, business context, and major stakeholders for this system type."
      ];
  }
}

function buildProblemOutputs(context: FoundationContext): string[] {
  const { manifest } = context;
  const outputs = [
    "Describe the user problem, operating context, and success criteria in concrete terms."
  ];

  if (manifest.projectPhase === "existing") {
    outputs.push(
      "Describe the current product use, active user jobs, known pain points, and what must stay stable during refactoring or adoption."
    );
  }

  switch (manifest.systemType) {
    case "content-site":
      outputs.push(
        "Describe editorial workflow, publishing latency expectations, content ownership, and how discoverability affects success."
      );
      break;
    case "api-platform":
      outputs.push(
        "Describe primary API consumers, their core jobs, integration expectations, and the operational guarantees they care about."
      );
      break;
    case "realtime-app":
      outputs.push(
        "Describe the moments where live collaboration, presence, or low-latency updates materially change the user experience."
      );
      break;
    case "data-platform":
      outputs.push(
        "Describe data producers, downstream consumers, freshness expectations, and the business decisions blocked by low-quality data."
      );
      break;
    case "b2b-saas":
      outputs.push(
        "Describe customer workflows, account-level admin needs, and where tenant isolation affects product trust."
      );
      break;
    default:
      break;
  }

  return unique(outputs);
}

function buildCurrentStateOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Describe the current runtime shape, repository structure, integration boundaries, and where responsibility is unclear today."
  ];

  if (scan.routeHints.length > 0 || scan.apiHints.length > 0) {
    outputs.push("Name the current route, API, or handler surfaces that define real production behavior today.");
  }

  if (scan.realtimeToolHints.length > 0) {
    outputs.push(
      `Describe the current realtime flow and operational assumptions around ${scan.realtimeToolHints.join(", ")}.`
    );
  }

  if (scan.dataToolHints.length > 0) {
    outputs.push(
      `Describe the current data ownership, migration flow, and operational usage around ${scan.dataToolHints.join(", ")}.`
    );
  }

  if (manifest.projectContext.currentPainPoints.length > 0) {
    outputs.push("Tie each documented pain point to the current architecture or delivery surface that causes it.");
  }

  if (Object.keys(scan.scripts).length > 0 || scan.ciFiles.length > 0) {
    outputs.push(
      "Document the current script and automation path for build, test, release, or operational work so migration plans reflect real workflow friction."
    );
  }

  return unique(outputs);
}

function buildRefactorTargetOutputs(context: FoundationContext): string[] {
  const { manifest } = context;
  const outputs = [
    "Describe the target architecture, boundary changes, and the seams that should exist after refactoring or adoption."
  ];

  outputs.push(
    manifest.practiceProfiles.includes("ddd-core")
      ? "Name the target bounded contexts, ownership seams, and interfaces before large code moves."
      : "Name the target module or service boundaries before large code moves."
  );

  if (manifest.projectContext.stabilityConstraints.length > 0) {
    outputs.push("Make the target shape explicitly compatible with the stated stability constraints.");
  }

  return unique(outputs);
}

function buildCurrentRiskOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Describe current delivery risks, missing checks, and the operational or product failures that are most likely if the repository keeps drifting."
  ];

  if (scan.testHints.length === 0) {
    outputs.push("Call out the absence of explicit test signals as a current delivery risk.");
  }

  if (!scan.hasCi) {
    outputs.push("Call out missing CI or release gating if no existing automation is present.");
  }

  if (manifest.projectContext.currentPainPoints.length > 0) {
    outputs.push("Relate each documented pain point to a concrete delivery or operational risk.");
  }

  if (Object.keys(scan.scripts).length > 0) {
    outputs.push(
      "Identify which existing scripts are relied on today and where they fall short as delivery gates."
    );
  }

  return unique(outputs);
}

function buildMigrationPlanOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Describe the migration sequence from current state to target state, including checkpoints, rollback boundaries, and how risk is reduced step by step."
  ];

  if (manifest.projectContext.stabilityConstraints.length > 0) {
    outputs.push("Name which compatibility or stability constraints must be preserved at each migration stage.");
  }

  if (manifest.practiceProfiles.includes("tdd-first")) {
    outputs.push("Name the tests or verification steps that should lock each migration step before moving on.");
  }

  if (Object.keys(scan.scripts).length > 0 || scan.ciFiles.length > 0) {
    outputs.push(
      "Explain how existing scripts and automation will evolve during migration so teams do not lose their current release path."
    );
  }

  return unique(outputs);
}

function buildDataAndIntegrationOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Describe storage, data ownership, external integrations, and failure boundaries."
  ];

  switch (manifest.systemType) {
    case "content-site":
      outputs.push(
        "Describe CMS or content-source boundaries, preview flows, metadata ownership, and how cache invalidation or revalidation keeps published content fresh."
      );
      break;
    case "api-platform":
      outputs.push(
        "Describe contract ownership, versioning posture, idempotency requirements, rate limits, and webhook or callback boundaries."
      );
      break;
    case "realtime-app":
      outputs.push(
        "Describe channel or topic topology, ordering guarantees, reconnect or recovery behavior, and duplicate-suppression boundaries."
      );

      if (scan.realtimeToolHints.includes("ably")) {
        outputs.push(
          "Describe Ably channel strategy, presence usage, message ordering expectations, and how connection recovery or resume behavior affects user-visible state."
        );
      }

      if (scan.realtimeToolHints.includes("socket.io")) {
        outputs.push(
          "Describe Socket.IO namespace or room ownership, reconnect behavior, ack expectations, and how duplicate or out-of-order events are contained."
        );
      }

      if (scan.realtimeToolHints.includes("ws")) {
        outputs.push(
          "Describe raw WebSocket session lifecycle, heartbeat or keepalive expectations, and where message contracts are validated."
        );
      }

      if (scan.realtimeToolHints.includes("pusher")) {
        outputs.push(
          "Describe channel authorization, event naming, and how client subscriptions recover from disconnects or missed updates."
        );
      }
      break;
    case "data-platform":
      outputs.push(
        "Describe ingestion stages, transformation ownership, lineage visibility, replay or backfill boundaries, and data-quality checkpoints."
      );

      if (scan.dataToolHints.includes("supabase")) {
        outputs.push(
          "Describe Supabase or Postgres ownership, migration flow, policy or access boundaries, and how operational analytics workloads are separated from product traffic."
        );
      }

      if (scan.dataToolHints.includes("drizzle")) {
        outputs.push(
          "Describe how Drizzle schema definitions, migrations, and query contracts stay aligned with warehouse or application data ownership."
        );
      }

      if (scan.dataToolHints.includes("prisma")) {
        outputs.push(
          "Describe how Prisma schema changes, generated clients, and relation loading expectations are reviewed before rollout."
        );
      }

      if (scan.dataToolHints.includes("typeorm")) {
        outputs.push(
          "Describe entity ownership, migration safety, and how ORM-level abstractions avoid hiding critical data-quality boundaries."
        );
      }
      break;
    default:
      break;
  }

  if (manifest.backend === "fastify") {
    outputs.push(
      "Describe which schemas are source-of-truth for request, response, and integration payloads."
    );
  }

  if (manifest.backend === "serverless") {
    outputs.push(
      "Describe event payload contracts, retry surfaces, and which integrations require idempotency keys or deduplication."
    );
  }

  if (manifest.frontend === "next" && manifest.systemType === "content-site") {
    outputs.push(
      "Describe how route-level caching, revalidation, and metadata generation map to content freshness requirements."
    );
  }

  return unique(outputs);
}

function buildDeliveryOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = ["Describe how design, implementation, review, and release handoffs should flow."];

  if (manifest.projectPhase === "existing") {
    outputs.push(
      "Describe how current-state analysis, target-state agreement, and migration checkpoints should flow before implementation work broadens."
    );
  }

  if (manifest.qualityProfiles.includes("ci-basic")) {
    outputs.push("Describe which checks should gate merges or releases once implementation begins.");
    outputs.push(
      `Keep automation aligned with the detected install command (${scan.installCommand}) and the meaningful scripts already present in the repository.`
    );
  }

  switch (manifest.systemType) {
    case "content-site":
      outputs.push(
        "Describe preview or staging review for content changes, metadata validation, and performance checks for critical entry pages."
      );
      break;
    case "api-platform":
      outputs.push(
        "Describe contract review, auth or permission review, observability checks, and backward-compatibility gates before rollout."
      );
      break;
    case "realtime-app":
      outputs.push(
        "Describe how live-flow changes are staged, how reconnect or load behavior is checked, and what rollback signals matter most."
      );
      break;
    case "data-platform":
      outputs.push(
        "Describe migration windows, replay or backfill rehearsal, data-quality gates, and how downstream consumers are protected during rollout."
      );
      break;
    default:
      break;
  }

  if (scan.hasCi) {
    outputs.push("Describe how existing CI signals map to design verification and rollout confidence.");
  }

  return unique(outputs);
}

function buildTestingOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Describe acceptance, integration, and unit-test expectations for the first implementation phase."
  ];

  if (manifest.constraints.includes("auth")) {
    outputs.push(
      "Call out role, permission, forbidden-path, and session-scope tests for the highest-risk auth-sensitive flows."
    );
  }

  if (manifest.frontend === "next") {
    outputs.push(
      "Call out route-level tests for loading, error, and mutation flows across server and client boundaries."
    );
  }

  if (manifest.frontend === "react-spa") {
    outputs.push(
      "Call out component or integration tests for navigation, async state, and cache invalidation without relying on incidental effects."
    );
  }

  if (manifest.backend === "fastify") {
    outputs.push(
      "Call out contract tests for schema-backed handlers and integration tests for plugin or service boundaries."
    );
  }

  if (manifest.backend === "nest") {
    outputs.push(
      "Call out module- or provider-level tests plus higher-level request flow coverage for critical endpoints."
    );
  }

  if (manifest.backend === "serverless") {
    outputs.push(
      "Call out idempotency, retry, and event-contract tests for function-triggered flows."
    );
  }

  switch (manifest.systemType) {
    case "content-site":
      outputs.push(
        "Call out preview, publish, metadata, search-index, and broken-link tests for the highest-value content paths."
      );
      break;
    case "api-platform":
      outputs.push(
        "Call out contract compatibility, auth enforcement, idempotency, and error-shape coverage for consumer-facing endpoints."
      );
      break;
    case "realtime-app":
      outputs.push(
        "Call out event ordering, reconnect, presence, duplicate-delivery, and degraded-network scenarios for live flows."
      );

      if (scan.realtimeToolHints.includes("ably")) {
        outputs.push(
          "Call out channel resume or recovery tests, presence accuracy checks, and subscriber catch-up scenarios for Ably-backed flows."
        );
      }

      if (scan.realtimeToolHints.includes("socket.io")) {
        outputs.push(
          "Call out room or namespace isolation tests, reconnect behavior, and ack or retry coverage for Socket.IO flows."
        );
      }
      break;
    case "data-platform":
      outputs.push(
        "Call out ingestion validation, schema evolution, replay or backfill safety, and data-quality checks for critical pipelines."
      );

      if (scan.dataToolHints.includes("supabase")) {
        outputs.push(
          "Call out migration smoke tests, query-performance checks, and policy or access-control validation for Supabase-backed data paths."
        );
      }

      if (scan.dataToolHints.includes("drizzle")) {
        outputs.push(
          "Call out schema-to-query regression tests so Drizzle migrations and typed queries stay aligned."
        );
      }
      break;
    default:
      break;
  }

  return unique(outputs);
}

function buildVerificationOutputs(context: FoundationContext): string[] {
  const { manifest, scan } = context;
  const outputs = [
    "Name the commands or evidence expected before major implementation claims are accepted."
  ];

  if (manifest.constraints.includes("auth")) {
    outputs.push(
      "Include evidence for role checks, permission boundaries, forbidden-path behavior, and session-scope assumptions."
    );
  }

  if (manifest.frontend === "next") {
    outputs.push(
      "Include evidence for cache or revalidation behavior, route-level loading states, and key user flows."
    );
  }

  if (manifest.backend === "fastify") {
    outputs.push(
      "Include evidence for schema-backed contracts, handler behavior, and key error responses."
    );
  }

  if (manifest.backend === "serverless") {
    outputs.push(
      "Include evidence for retry safety, event handling, and downstream failure behavior."
    );
  }

  switch (manifest.systemType) {
    case "content-site":
      outputs.push(
        "Include evidence for metadata quality, preview or publish transitions, and delivery performance on key content surfaces."
      );
      break;
    case "api-platform":
      outputs.push(
        "Include evidence for backward-compatible contracts, auth behavior, observability, and failure-mode coverage for external consumers."
      );
      break;
    case "realtime-app":
      outputs.push(
        "Include evidence for reconnect behavior, ordering guarantees, presence accuracy, and degraded-network handling."
      );

      if (scan.realtimeToolHints.includes("ably")) {
        outputs.push(
          "Include evidence for connection recovery, channel resume behavior, and presence state convergence when clients disconnect and reconnect."
        );
      }
      break;
    case "data-platform":
      outputs.push(
        "Include evidence for lineage visibility, replay or backfill behavior, schema change handling, and data-quality monitoring hooks."
      );

      if (scan.dataToolHints.includes("supabase")) {
        outputs.push(
          "Include evidence for migration safety, query observability, and policy or permission checks on Supabase-backed paths."
        );
      }

      if (scan.dataToolHints.includes("drizzle")) {
        outputs.push(
          "Include evidence that generated migrations and typed query usage stay aligned with the intended schema boundary."
        );
      }
      break;
    default:
      break;
  }

  return unique(outputs);
}

function buildSkillInstallerGuidance(
  context: FoundationContext,
  skills: string[],
  availableMessage: string,
  fallback: string
): string {
  const missingSkills = buildMissingSkillNames(context, skills);

  if (missingSkills.length > 0 && context.scan.hasSkillInstaller) {
    return `If work would benefit from missing skills, explicitly propose the local \`skill-installer\` workflow for: ${missingSkills.join(", ")}.`;
  }

  if (context.scan.hasSkillInstaller) {
    return availableMessage;
  }

  return fallback;
}

function buildRecommendedSkillNames(
  context: FoundationContext,
  category: "design" | "testing" | "research" | "all"
): string[] {
  const { manifest, scan } = context;
  const skills: string[] = [];

  const add = (...names: string[]) => {
    for (const name of names) {
      if (name) {
        skills.push(name);
      }
    }
  };

  if (category === "design" || category === "all") {
    if (manifest.frontend === "next") {
      add("next-best-practices", "vercel-react-best-practices");
    }

    if (manifest.frontend === "react-spa") {
      add("vercel-react-best-practices", "web-design-guidelines");
    }

    if (
      manifest.backend === "nest" ||
      manifest.backend === "fastify" ||
      manifest.backend === "serverless" ||
      manifest.systemType === "api-platform"
    ) {
      add("api-design-principles");
    }

    if (manifest.constraints.some((value) => ["auth", "payments", "pii"].includes(value))) {
      add("security-review", "owasp-security-check");
    }

    if (manifest.qualityProfiles.includes("ci-basic")) {
      add("github-actions-templates");
    }

    if (manifest.systemType === "content-site") {
      add("frontend-design", "web-design-guidelines", "critique", "audit");
    }

    if (manifest.systemType === "api-platform") {
      add("api-design-principles", "security-review", "owasp-security-check");
    }

    if (manifest.systemType === "realtime-app") {
      add("api-design-principles", "playwright", "systematic-debugging");
    }

    if (manifest.systemType === "data-platform") {
      add("supabase-postgres-best-practices", "systematic-debugging");
    }
  }

  if (category === "testing" || category === "all") {
    if (manifest.practiceProfiles.includes("tdd-first") || scan.testHints.length > 0) {
      add("vitest");
    }

    if (manifest.frontend !== "none" || scan.testHints.includes("Playwright")) {
      add("playwright");
    }

    if (manifest.practiceProfiles.includes("strict-verification")) {
      add("verification-before-completion");
    }

    if (manifest.constraints.some((value) => ["auth", "payments", "pii"].includes(value))) {
      add("security-review", "owasp-security-check");
    }

    if (manifest.systemType === "realtime-app") {
      add("playwright", "systematic-debugging");
    }

    if (manifest.systemType === "data-platform") {
      add("supabase-postgres-best-practices", "systematic-debugging");
    }

    if (manifest.systemType === "content-site") {
      add("playwright", "audit");
    }

    if (manifest.systemType === "api-platform") {
      add("api-design-principles", "owasp-security-check");
    }
  }

  if (category === "research" || category === "all") {
    add("systematic-debugging", "remembering-conversations");

    if (scan.dataHints.some((value) => /supabase|drizzle|prisma/i.test(value))) {
      add("supabase-postgres-best-practices");
    }

    if (
      manifest.backend === "nest" ||
      manifest.backend === "fastify" ||
      manifest.systemType === "api-platform"
    ) {
      add("api-design-principles");
    }

    if (manifest.systemType === "data-platform") {
      add("supabase-postgres-best-practices");
    }

    if (manifest.systemType === "content-site") {
      add("frontend-design", "critique", "audit");
    }

    if (manifest.systemType === "realtime-app") {
      add("systematic-debugging");
    }
  }

  if (scan.packageManager === "pnpm") {
    add("pnpm");
  }

  return unique(skills).sort();
}

function buildInstalledSkillNames(context: FoundationContext, skills: string[]): string[] {
  const available = new Set(context.scan.availableSkills);
  return skills.filter((skill) => available.has(skill)).sort();
}

function buildMissingSkillNames(context: FoundationContext, skills: string[]): string[] {
  const available = new Set(context.scan.availableSkills);
  return skills.filter((skill) => !available.has(skill)).sort();
}

function buildPracticeImplications(practice: string): string[] {
  switch (practice) {
    case "ddd-core":
      return [
        "Use domain language consistently across product, architecture, and API docs.",
        "Define bounded contexts, aggregates, and service seams before implementation begins."
      ];
    case "tdd-first":
      return [
        "Capture red-green-refactor expectations before implementation starts.",
        "Identify acceptance, integration, and unit-test layers for the highest-risk behaviors."
      ];
    case "strict-verification":
      return [
        "Require explicit verification commands or evidence for major claims.",
        "Treat missing proof as a review issue, not a style preference."
      ];
    default:
      return [];
  }
}

function isPlaceholderScript(name: string, command: string | undefined): boolean {
  if (!command) {
    return false;
  }

  const normalized = command.trim().replace(/\s+/g, " ").toLowerCase();

  if (
    name === "test" &&
    normalized.includes("no test specified") &&
    normalized.includes("exit 1")
  ) {
    return true;
  }

  return false;
}

function buildCiWorkflow(scan: RepositoryScan): string {
  const hasLintScript = Boolean(scan.scripts.lint) && !isPlaceholderScript("lint", scan.scripts.lint);
  const hasTestScript = Boolean(scan.scripts.test) && !isPlaceholderScript("test", scan.scripts.test);
  const hasBuildScript =
    Boolean(scan.scripts.build) && !isPlaceholderScript("build", scan.scripts.build);
  const steps = [
    "      - uses: actions/checkout@v4",
    "      - uses: actions/setup-node@v4",
    "        with:",
    "          node-version: 20"
  ];

  if (scan.packageManager === "pnpm") {
    steps.push("      - uses: pnpm/action-setup@v4");
    steps.push("        with:");
    steps.push("          version: 9");
    steps.push(`      - run: ${scan.installCommand}`);
  } else {
    steps.push(`      - run: ${scan.installCommand}`);
  }

  if (hasLintScript) {
    steps.push(`      - run: ${scan.packageManager === "pnpm" ? "pnpm lint" : scan.packageManager === "yarn" ? "yarn lint" : scan.packageManager === "bun" ? "bun run lint" : "npm run lint"}`);
  }

  if (hasTestScript) {
    steps.push(`      - run: ${scan.packageManager === "pnpm" ? "pnpm test" : scan.packageManager === "yarn" ? "yarn test" : scan.packageManager === "bun" ? "bun run test" : "npm test"}`);
  }

  if (hasBuildScript) {
    steps.push(`      - run: ${scan.packageManager === "pnpm" ? "pnpm build" : scan.packageManager === "yarn" ? "yarn build" : scan.packageManager === "bun" ? "bun run build" : "npm run build"}`);
  }

  if (!hasLintScript && !hasTestScript && !hasBuildScript) {
    steps.push('      - run: echo "No lint/test/build scripts detected during foundation setup."');
  }

  return [
    "name: CI",
    "",
    "on:",
    "  push:",
    "  pull_request:",
    "",
    "jobs:",
    "  validate:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    ...steps
  ].join("\n");
}

function buildRepoFactsBullets(context: FoundationContext): string[] {
  const { scan } = context;
  const facts = buildScanFacts(scan);

  if (scan.scripts && Object.keys(scan.scripts).length > 0) {
    facts.push(`Detected package scripts: ${Object.entries(scan.scripts).map(([name, script]) => `${name} -> ${script}`).join("; ")}.`);
  }

  facts.push(
    `Recommended setup path: ${scan.phaseRecommendation}${scan.phaseRecommendationReasons.length > 0 ? ` (${scan.phaseRecommendationReasons.join("; ")})` : ""}.`
  );

  return facts;
}

function buildSelectedDesignPriorities(context: FoundationContext): string[] {
  const { manifest } = context;
  const priorities: string[] = [];

  if (manifest.projectPhase === "existing") {
    priorities.push("Document current state and migration steps before forcing a target redesign.");
  }

  if (manifest.practiceProfiles.includes("ddd-core")) {
    priorities.push("Define domain language, boundaries, and ownership seams early.");
  }

  if (manifest.practiceProfiles.includes("tdd-first")) {
    priorities.push("Name high-risk behaviors and the tests that should exist before implementation.");
  }

  if (manifest.practiceProfiles.includes("strict-verification")) {
    priorities.push("Require concrete verification evidence for important claims.");
  }

  if (manifest.constraints.includes("payments")) {
    priorities.push("Treat payment failure handling, reconciliation, and auditability as first-order concerns.");
  }

  if (manifest.constraints.includes("auth")) {
    priorities.push("Make trust boundaries, roles, and permission checks explicit.");
  }

  return priorities;
}

function renderConstraintIndex(context: FoundationContext): string {
  const selected = context.manifest.constraints;
  const selectedRefs =
    selected.length > 0
      ? selected.map((constraint) => `- ${constraint}: ${code(`docs/product/constraints/${constraint}.md`)}`).join("\n")
      : "- none selected";

  return renderMergeManagedDocument(
    "Constraint Index",
    "constraint-index",
    [
      "## Confirmed facts",
      selected.length > 0
        ? `- Selected constraints: ${selected.join(", ")}.`
        : "- No explicit constraints were selected during setup.",
      "",
      "## Working assumptions",
      selected.length > 0
        ? "- Constraint-specific docs should be treated as high-signal starting inputs and refined as the service design becomes more concrete."
        : "- Additional constraint docs can be added later if new risks appear.",
      "",
      "## Open questions",
      toBulletList(
        buildOpenQuestionList(context, [
          "Do any non-selected constraints still deserve partial treatment in the first design pass?"
        ])
      ),
      "",
      "## Required outputs",
      selectedRefs
    ].join("\n")
  );
}

export async function buildRepositoryFileContent(
  repositoryPath: string,
  context: FoundationContext
): Promise<string> {
  const { manifest, scan } = context;
  const projectContext = manifest.projectContext;
  const activeWorkItemPath = resolveActiveWorkItemPath(manifest);
  const initialDecisionDocPath = buildInitialDecisionDocPath(manifest.projectPhase);

  if (
    repositoryPath.endsWith("/AGENTS.md") &&
    repositoryPath !== "AGENTS.md" &&
    !repositoryPath.startsWith(".")
  ) {
    return renderSubtreeAdapter({
      provider: "codex",
      rootPath: path.posix.dirname(repositoryPath),
      areaDocPath: `docs/architecture/areas/${path
        .posix
        .dirname(repositoryPath)
        .replaceAll("/", "--")}.md`
    });
  }

  if (
    repositoryPath.endsWith("/CLAUDE.md") &&
    repositoryPath !== "CLAUDE.md" &&
    !repositoryPath.startsWith(".")
  ) {
    return renderSubtreeAdapter({
      provider: "claude",
      rootPath: path.posix.dirname(repositoryPath),
      areaDocPath: `docs/architecture/areas/${path
        .posix
        .dirname(repositoryPath)
        .replaceAll("/", "--")}.md`
    });
  }

  if (
    repositoryPath.endsWith("/GEMINI.md") &&
    repositoryPath !== "GEMINI.md" &&
    !repositoryPath.startsWith(".")
  ) {
    return renderSubtreeAdapter({
      provider: "gemini",
      rootPath: path.posix.dirname(repositoryPath),
      areaDocPath: `docs/architecture/areas/${path
        .posix
        .dirname(repositoryPath)
        .replaceAll("/", "--")}.md`
    });
  }

  if (repositoryPath.startsWith("docs/architecture/areas/")) {
    const areaRoot = path.basename(repositoryPath, ".md").replaceAll("--", "/");
    const subtree = findSubtreeScan(scan, areaRoot);
    return renderMergeManagedDocument(
      `Area: ${areaRoot}`,
      `area-${path.basename(repositoryPath, ".md")}`,
      renderStructuredBody(context, {
        confirmedFacts: [
          `Scoped root: ${areaRoot}.`,
          ...(subtree?.packageName ? [`Package name: ${subtree.packageName}.`] : []),
          ...(scan.subtreeRoots.includes(areaRoot)
            ? ["This subtree was detected as a major work root during repository scan."]
            : []),
          ...Object.entries(subtree?.scripts ?? {}).map(
            ([name, script]) => `Subtree script ${name} -> ${script}.`
          ),
          ...scan.routeHints
            .filter((value) => value.startsWith(areaRoot))
            .map((value) => `Route surface inside subtree: ${value}.`),
          ...scan.apiHints
            .filter((value) => value.startsWith(areaRoot))
            .map((value) => `API surface inside subtree: ${value}.`)
        ],
        workingAssumptions: buildAssumptions(context, [
          "This area doc should stay narrow and point back to broader architecture docs only when the subtree cannot be understood locally."
        ]),
        requiredOutputs: buildRequiredOutputs(context, [
          "Describe the responsibility of this subtree, the main commands used here, and the nearest architecture boundaries it touches."
        ])
      })
    );
  }

  switch (repositoryPath) {
    case "AGENTS.md":
      return [
        "# Agent Entry",
        "",
        renderManagedBlock(
          "startup-sequence",
          [
            "Start here:",
            "",
            "1. `docs/agents/repo-facts.md`",
            "2. `docs/index.md`",
            "3. `.agent-foundation/handoffs/current.md`",
            "",
            "Open deeper docs only when `docs/index.md` or your current task requires them.",
            "Stay in design mode until the design pack is coherent."
          ].join("\n")
        ),
        "",
        "## Local Notes",
        "Add repo-specific notes below this line. `sync` preserves content outside managed blocks.",
        ""
      ].join("\n");
    case "CLAUDE.md":
      return [
        "# Claude Code Entry",
        "",
        renderManagedBlock(
          "startup-sequence",
          [
            "Use these imports as the initial context set:",
            "",
            "@docs/agents/repo-facts.md",
            "@docs/index.md",
            "@.agent-foundation/handoffs/current.md",
            "",
            "Load deeper docs only when they are relevant to the current task."
          ].join("\n")
        ),
        "",
        "## Local Notes",
        "Add repo-specific notes below this line. `sync` preserves content outside managed blocks.",
        ""
      ].join("\n");
    case "GEMINI.md":
      return [
        "# Gemini CLI Entry",
        "",
        renderManagedBlock(
          "startup-sequence",
          [
            "Use this workspace context first:",
            "",
            "- `docs/agents/repo-facts.md`",
            "- `docs/index.md`",
            "- `.agent-foundation/handoffs/current.md`",
            "",
            "Load deeper docs or subtree context files only when they are relevant to the task at hand."
          ].join("\n")
        ),
        "",
        "## Local Notes",
        "Add repo-specific notes below this line. `sync` preserves content outside managed blocks.",
        ""
      ].join("\n");
    case ".agent-foundation/handoff/design-ready.md":
      const allRecommendedSkills = buildRecommendedSkillNames(context, "all");
      return renderManagedDocument(
        "Design-Ready Handoff",
        [
          "## Mission",
          manifest.projectPhase === "existing"
            ? "Document the current repository, define the target state, and produce a credible migration path before implementation broadens."
            : "Produce or refine project design documentation before implementation starts.",
          "",
          "## Required reading order",
          toNumberedList([
            "Read the root instruction file for your client (`AGENTS.md` for Codex, `CLAUDE.md` for Claude Code, `GEMINI.md` for Gemini CLI).",
            "Read `docs/agents/repo-facts.md` before making architectural assumptions.",
            "Read `.agent-foundation/handoffs/current.md` for active mode, work item, and freshness notes.",
            "Use `docs/index.md` to decide which deeper docs matter for the current design task."
          ]),
          "",
          "## Working rules",
          toBulletList([
            "Stay in design mode. Do not implement application code as part of the first pass.",
            "Separate confirmed facts from working assumptions.",
            "Update the generated design docs in place rather than creating side channels.",
            "Load deeper docs on demand instead of reading the whole docs tree by default.",
            "Treat repository-local skills under `.agents/skills/` as optional, on-demand capabilities rather than startup context.",
            buildSkillInstallerGuidance(
              context,
              allRecommendedSkills,
              "Before deep work, if the current local skills are not enough, explicitly propose the local `skill-installer` workflow instead of inventing one-off setup advice.",
              "Before deep work, check the generated skills guidance and explicitly note any missing skills before proceeding without them."
            )
          ]),
          "",
          "## Primary outputs",
          toBulletList([
            manifest.projectPhase === "existing"
              ? "Capture the current product use, architecture reality, and delivery risks without overwriting existing repository materials."
              : "Make the product problem, domain language, and major constraints explicit.",
            manifest.projectPhase === "existing"
              ? "Define a coherent target architecture and the migration sequence from current state to target state."
              : "Produce a coherent architecture shape with clear boundaries and integration edges.",
            "Define testing and verification expectations for the first implementation phase."
          ])
        ].join("\n")
      );
    case ".agent-foundation/handoffs/current.md":
      return renderManagedDocument(
        "Current Handoff",
        [
          "## Objective",
          manifest.projectPhase === "existing"
            ? "Keep the repository understandable while current-state analysis, target-state design, and migration planning progress together."
            : "Keep the active design or implementation objective visible so the next agent can continue without re-reading the whole repository.",
          "",
          "## Mode",
          `Current workflow mode: ${manifest.workflowState.mode}.`,
          "",
          "## Active Work Item",
          activeWorkItemPath
            ? `Current active work item: ${code(activeWorkItemPath)}.`
            : "No active work item is recorded in the manifest yet.",
          "",
          "## Done",
          toBulletList([
            "Foundation startup docs were generated.",
            manifest.projectPhase === "existing"
              ? "Current-state and migration-oriented docs are available."
              : "Greenfield product, architecture, and engineering scaffolds are available."
          ]),
          "",
          "## Next Steps",
          toBulletList([
            "Use `docs/index.md` to choose the next scoped document instead of loading the whole tree.",
            ...(activeWorkItemPath
              ? [`Continue from ${code(activeWorkItemPath)} before opening unrelated docs.`]
              : []),
            manifest.projectPhase === "existing"
              ? "Confirm current-state facts, target boundaries, and migration checkpoints before broad implementation work."
              : "Confirm problem framing, architecture boundaries, and verification expectations before broad implementation work."
          ]),
          "",
          "## Blockers",
          toBulletList(
            buildOpenQuestionList(context, [
              ...(activeWorkItemPath
                ? []
                : ["What active work item should be recorded once a concrete implementation or review task begins?"])
            ])
          ),
          "",
          "## Verification Commands",
          toBulletList(buildVerificationCommandBullets(scan)),
          "",
          "## Freshness",
          toBulletList([
            `Manifest generated at: ${manifest.generatedAt}.`,
            manifest.lastResolvedAt
              ? `Last resolved selection update: ${manifest.lastResolvedAt}.`
              : "This repository is still using an unresolved manifest.",
            "Refresh this handoff whenever workflow mode, active work, or core verification commands change."
          ])
        ].join("\n")
      );
    case ".claude/rules/index.md":
      return renderManagedDocument(
        "Claude Rules Index",
        [
          "Use these files as optional, task-specific imports for Claude Code.",
          "",
          "Available rules:",
          toBulletList([
            code(".claude/rules/architecture.md"),
            code(".claude/rules/testing.md")
          ]),
          "",
          "Selected profiles may add extra rule files such as frontend or constraint-specific guidance."
        ].join("\n")
      );
    case ".claude/rules/architecture.md":
      return renderManagedDocument(
        "Claude Rule: Architecture",
        toBulletList([
          "Work from `docs/index.md` and `docs/architecture/*` before proposing structural changes.",
          "Make boundaries, ownership, and integration seams explicit.",
          "Use selected constraints and practices to shape architecture, but keep the detailed rationale in the design docs."
        ])
      );
    case ".claude/rules/testing.md":
      return renderManagedDocument(
        "Claude Rule: Testing",
        toBulletList([
          "Work from `docs/engineering/testing-strategy.md` and `docs/rules/testing.md` before proposing test plans.",
          manifest.practiceProfiles.includes("tdd-first")
            ? "Prefer explicit acceptance, integration, and unit-test expectations before implementation."
            : "Keep testing expectations aligned with risk and behavior.",
          manifest.practiceProfiles.includes("strict-verification")
            ? "Ask for concrete proof before accepting important implementation claims."
            : "Name the evidence needed for major implementation claims."
        ])
      );
    case ".claude/rules/frontend.md":
      return renderManagedDocument(
        "Claude Rule: Frontend",
        toBulletList([
          "Use `docs/architecture/frontend.md` as the source of truth for frontend decisions.",
          "Make rendering boundaries, data loading, and UI state ownership explicit.",
          ...scan.routeHints.map((value) => `Existing route signal: ${value}.`)
        ])
      );
    case ".claude/rules/auth.md":
      return renderManagedDocument(
        "Claude Rule: Auth",
        toBulletList([
          "Use `docs/product/constraints/auth.md` before proposing auth-sensitive design changes.",
          "Make trust boundaries, roles, permissions, and access checks explicit.",
          "Call out any ambiguity around identity, session, or authorization scope."
        ])
      );
    case ".claude/rules/payments.md":
      return renderManagedDocument(
        "Claude Rule: Payments",
        toBulletList([
          "Use `docs/product/constraints/payments.md` before proposing payment-sensitive design changes.",
          "Treat retries, reconciliation, ledger correctness, and auditability as first-order concerns.",
          "Require explicit testing and verification expectations for payment flows."
        ])
      );
    case ".cursor/rules/architecture.mdc":
      return renderCursorRule(
        "Use when working on architecture, boundaries, or system design in this repository.",
        [
          "# Architecture rule",
          "",
          "- Start from `docs/index.md` and `docs/architecture/*`.",
          "- Make boundaries, ownership, and integration seams explicit.",
          "- Keep detailed rationale in the generated design docs instead of chat-only reasoning."
        ]
      );
    case ".cursor/rules/testing.mdc":
      return renderCursorRule(
        "Use when planning tests, verification, or engineering quality expectations.",
        [
          "# Testing rule",
          "",
          "- Start from `docs/engineering/testing-strategy.md` and `docs/rules/testing.md`.",
          manifest.practiceProfiles.includes("tdd-first")
            ? "- Prefer explicit acceptance, integration, and unit-test expectations before implementation."
            : "- Keep testing expectations aligned with risk and behavior.",
          manifest.practiceProfiles.includes("strict-verification")
            ? "- Ask for concrete proof before accepting important implementation claims."
            : "- Name the evidence needed for major implementation claims."
        ]
      );
    case ".cursor/rules/frontend.mdc":
      return renderCursorRule(
        "Use when changing frontend architecture, rendering boundaries, or UI state ownership.",
        [
          "# Frontend rule",
          "",
          "- Use `docs/architecture/frontend.md` as the source of truth for frontend decisions.",
          "- Make rendering boundaries, data loading, and UI state ownership explicit.",
          ...scan.routeHints.map((value) => `- Existing route signal: ${value}.`)
        ]
      );
    case ".cursor/rules/auth.mdc":
      return renderCursorRule(
        "Use when a task touches auth, roles, permissions, or trust boundaries.",
        [
          "# Auth rule",
          "",
          "- Use `docs/product/constraints/auth.md` before proposing auth-sensitive changes.",
          "- Make trust boundaries, roles, permissions, and access checks explicit.",
          "- Call out ambiguity around identity, session, or authorization scope."
        ]
      );
    case ".cursor/rules/payments.mdc":
      return renderCursorRule(
        "Use when a task touches payments, billing, reconciliation, or financial correctness.",
        [
          "# Payments rule",
          "",
          "- Use `docs/product/constraints/payments.md` before proposing payment-sensitive changes.",
          "- Treat retries, reconciliation, ledger correctness, and auditability as first-order concerns.",
          "- Require explicit testing and verification expectations for payment flows."
        ]
      );
    case "docs/index.md":
      const activeConstraintDocs = buildActiveConstraintDocLinks(manifest);
      const activePracticeDocs = buildActivePracticeDocLinks(manifest);
      const activeProfileDocs = buildActiveProfileDocLinks(manifest);
      return renderMergeManagedDocument(
        "Repository Design Index",
        "repository-index",
        [
          "## Current snapshot",
          toBulletList([
            ...buildSelectionFacts(context),
            `Active handoff: ${code(".agent-foundation/handoffs/current.md")}.`,
            ...(activeWorkItemPath ? [`Current active work item: ${code(activeWorkItemPath)}.`] : []),
            "Use this file as the router for deeper documentation."
          ]),
          "",
          "## Read next by task",
          toBulletList([
            `Product framing: ${code("docs/product/index.md")}, ${code("docs/product/problem-and-users.md")}, ${code("docs/product/constraints.md")}.`,
            manifest.projectPhase === "existing"
              ? `Architecture design: ${code("docs/architecture/overview.md")}, ${code("docs/architecture/current-state.md")}, ${code("docs/architecture/refactor-target.md")}, ${code("docs/architecture/data-and-integrations.md")}.`
              : `Architecture design: ${code("docs/architecture/overview.md")}, ${code("docs/architecture/domain-boundaries.md")}, ${code("docs/architecture/data-and-integrations.md")}.`,
            manifest.projectPhase === "existing"
              ? `Engineering and delivery: ${code("docs/engineering/index.md")}, ${code("docs/engineering/current-delivery-risks.md")}, ${code("docs/engineering/migration-plan.md")}, ${code("docs/engineering/testing-strategy.md")}, ${code("docs/engineering/verification.md")}.`
              : `Engineering and delivery: ${code("docs/engineering/index.md")}, ${code("docs/engineering/testing-strategy.md")}, ${code("docs/engineering/verification.md")}.`,
            `Operations and decisions: ${code("docs/operations/index.md")}, ${code("docs/decisions/index.md")}, ${code("docs/work/index.md")}.`,
            `Rules and reusable guidance: ${code("docs/rules/index.md")}, ${code("docs/skills/index.md")}.`,
            ...(activeProfileDocs.length > 0
              ? [`Active profile docs: ${activeProfileDocs.join(", ")}.`]
              : []),
            ...(activeConstraintDocs.length > 0
              ? [`Active constraint docs: ${activeConstraintDocs.join(", ")}.`]
              : []),
            ...(activePracticeDocs.length > 0
              ? [`Active practice docs: ${activePracticeDocs.join(", ")}.`]
              : [])
          ]),
          "",
          "## Focus areas",
          toBulletList(buildSelectedDesignPriorities(context), "- no additional focus areas selected")
        ].join("\n")
      );
    case "docs/agents/context-map.md":
      return renderMergeManagedDocument(
        "Context Map",
        "context-map",
        [
          "## Confirmed facts",
          toBulletList([
            ...buildSelectionFacts(context),
            "The repository uses the forTheAgent foundation contract.",
            "Root entrypoints are `AGENTS.md` for Codex, `CLAUDE.md` for Claude Code, and `GEMINI.md` for Gemini CLI."
          ]),
          "",
          "## Use this file for",
          toBulletList([
            "A quick map of the repository contract and current design posture.",
            "Orienting new agents before they dive into deeper product or architecture docs."
          ]),
          "",
          "## Next useful docs",
          toBulletList([
            code("docs/index.md"),
            code("docs/agents/design-handoff.md"),
            code(".agent-foundation/handoffs/current.md"),
            code("docs/skills/index.md")
          ])
        ].join("\n")
      );
    case "docs/agents/repo-facts.md":
      return renderManagedDocument(
        "Repository Facts",
        [
          "## Confirmed facts",
          toBulletList(buildRepoFactsBullets(context)),
          "",
          "## Existing documentation and signals",
          toBulletList(
            [...scan.importantFiles.map((value) => code(value)), ...buildEngineeringSignals(scan)],
            "- no additional high-signal files detected"
          )
        ].join("\n")
      );
    case "docs/agents/design-handoff.md":
      const designHandoffSkills = buildRecommendedSkillNames(context, "all");
      return renderMergeManagedDocument(
        "Design Handoff",
        "design-handoff",
        [
          "## Confirmed facts",
          toBulletList([
            "This repository was bootstrapped for a design-first handoff.",
            ...buildSelectionFacts(context)
          ]),
          "",
          "## Deliverables for the next design pass",
          toBulletList([
            manifest.projectPhase === "existing"
              ? "Capture the current product use, active user jobs, and the pain points driving this refactor or adoption."
              : "Refine the product problem, target users, and glossary so the domain language is stable.",
            manifest.projectPhase === "existing"
              ? "Describe the current architecture, the target architecture, and the migration boundary between them."
              : "Define architecture boundaries, integration edges, and major decision tradeoffs.",
            "Make constraints and verification expectations visible in the design docs.",
            "Use the recommended skills from `docs/skills/index.md` when they are available in the environment.",
            buildSkillInstallerGuidance(
              context,
              designHandoffSkills,
              "When a missing local capability would materially improve the design pass, explicitly propose the local `skill-installer` workflow.",
              "If important work would benefit from a missing skill, say so before substituting generic guidance."
            )
          ]),
          "",
          "## Escalate explicitly",
          toBulletList([
            "Unresolved product assumptions.",
            "Boundary decisions that change data ownership or deployment shape.",
            "Missing test or verification strategy for high-risk flows."
          ])
        ].join("\n")
      );
    case "docs/agents/docs-contract.md":
      return renderMergeManagedDocument(
        "Docs Contract",
        "docs-contract",
        [
          "## Confirmed facts",
          toBulletList([
            "Root startup adapters should remain short and point to exactly three startup docs.",
            `Startup docs: ${code("docs/agents/repo-facts.md")}, ${code("docs/index.md")}, ${code(".agent-foundation/handoffs/current.md")}.`,
            "Durable knowledge lives under docs/product, docs/system, docs/architecture, docs/engineering, docs/operations, and docs/decisions.",
            "Active work state lives under docs/work and the current handoff."
          ]),
          "",
          "## Working assumptions",
          toBulletList([
            "Provider-specific files should stay thin adapters rather than duplicating narrative guidance.",
            "Every managed markdown doc should carry contract frontmatter so doctor can validate freshness and reachability.",
            "This contract standardizes context routing, continuity, and verification expectations; it does not fix the final service architecture."
          ]),
          "",
          "## Open questions",
          toBulletList([
            "Which additional subtree roots deserve local adapters as the repository grows?"
          ]),
          "",
          "## Required outputs",
          toBulletList([
            "Keep startup context minimal and route deeper reading through docs/index or subtree adapters.",
            "Update doc metadata when repository workflow or ownership changes.",
            "Use doc-health and doctor warnings to catch stale or orphaned documentation."
          ])
        ].join("\n")
      );
    case "docs/product/index.md":
      const productConstraintDocs = buildActiveConstraintDocLinks(manifest);
      return renderMergeManagedDocument(
        "Product Context Index",
        "product-index",
        [
          "## Confirmed facts",
          toBulletList([
            projectContext.primaryProduct
              ? `Primary product or use case: ${projectContext.primaryProduct}.`
              : "Primary product or use case is still unconfirmed.",
            `Problem and users doc: ${code("docs/product/problem-and-users.md")}.`,
            `Domain glossary doc: ${code("docs/product/domain-glossary.md")}.`,
            `Constraint index doc: ${code("docs/product/constraints.md")}.`
          ]),
          "",
          "## Read next",
          toBulletList([
            code("docs/product/problem-and-users.md"),
            code("docs/product/domain-glossary.md"),
            code("docs/product/constraints.md"),
            ...productConstraintDocs
          ]),
          "",
          "## Focus",
          toBulletList([
            "Keep product language aligned with architecture and testing docs.",
            "Promote stable domain terms into the glossary."
          ])
        ].join("\n")
      );
    case "docs/product/problem-and-users.md":
      return renderMergeManagedDocument(
        "Problem and Users",
        "problem-users",
        renderStructuredBody(context, {
          confirmedFacts: [
            projectContext.primaryProduct
              ? `Primary product or use case: ${projectContext.primaryProduct}.`
              : "Primary product or use case has not been written down yet.",
            ...projectContext.targetUsers.map((value) => `Target user group: ${value}.`),
            ...(manifest.projectPhase === "existing"
              ? projectContext.currentPainPoints.map((value) => `Current pain point: ${value}.`)
              : [])
          ],
          openQuestions: buildOpenQuestionList(context, [
            "What jobs should the first design prioritize for target users?"
          ]),
          requiredOutputs: buildRequiredOutputs(context, buildProblemOutputs(context))
        })
      );
    case "docs/product/domain-glossary.md":
      return renderMergeManagedDocument(
        "Domain Glossary",
        "domain-glossary",
        renderStructuredBody(context, {
          confirmedFacts: projectContext.coreEntities.map((value) => `Core entity candidate: ${value}.`),
          workingAssumptions: buildAssumptions(context, [
            manifest.practiceProfiles.includes("ddd-core")
              ? "Domain terms should be stable enough to shape bounded contexts and interfaces."
              : "This glossary should still capture important domain nouns even without a formal DDD commitment."
          ]),
          openQuestions: buildOpenQuestionList(context, [
            "Which terms are overloaded today and need sharper definitions?"
          ]),
          requiredOutputs: buildRequiredOutputs(context, [
            "Define stable domain terms, aliases, and ambiguous language that should be avoided."
          ])
        })
      );
    case "docs/product/constraints.md":
      return renderConstraintIndex(context);
    case "docs/architecture/overview.md":
      const architectureProfileDocs = buildActiveProfileDocLinks(manifest);
      return renderMergeManagedDocument(
        "Architecture Overview",
        "architecture-overview",
        [
          "## Confirmed facts",
          toBulletList([
            ...buildSelectionFacts(context),
            ...buildScanFacts(scan)
          ]),
          "",
          "## Design questions to answer here",
          toBulletList([
            manifest.projectPhase === "existing"
              ? "What is the current system shape and what should remain stable while it changes?"
              : "What is the intended system shape and deployment model?",
            "Where are the major domain and integration boundaries?",
            manifest.projectPhase === "existing"
              ? "Which target-state changes are worth the migration cost and operational risk?"
              : "Which tradeoffs are driven by selected constraints and practices?",
            ...(architectureProfileDocs.length > 0
              ? [`Which profile-specific docs need immediate refinement: ${architectureProfileDocs.join(", ")}?`]
              : [])
          ]),
          "",
          "## Focus areas",
          toBulletList(
            [
              ...buildArchitectureStyleImplications(manifest.architectureStyle),
              ...buildSelectedDesignPriorities(context),
              ...(architectureProfileDocs.length > 0
                ? [`Use ${architectureProfileDocs.join(", ")} as the next drill-down docs for stack-level design.`]
                : [])
            ],
            "- no additional focus areas selected"
          )
        ].join("\n")
      );
    case "docs/architecture/frontend.md":
      return renderMergeManagedDocument(
        "Frontend Architecture",
        "frontend-foundation",
        renderStructuredBody(context, {
          confirmedFacts: [
            manifest.frontend
              ? `Selected frontend profile: ${manifest.frontend}.`
              : "No explicit frontend profile has been selected.",
            ...buildFrontendProfileImplications(manifest.frontend),
            ...scan.routeHints.map((value) => `Route-related structure detected in ${value}.`)
          ],
          requiredOutputs: buildRequiredOutputs(
            context,
            buildFrontendRequiredOutputs(manifest.frontend)
          )
        })
      );
    case "docs/architecture/backend.md":
      return renderMergeManagedDocument(
        "Backend Architecture",
        "backend-foundation",
        renderStructuredBody(context, {
          confirmedFacts: [
            manifest.backend
              ? `Selected backend profile: ${manifest.backend}.`
              : "No explicit backend profile has been selected.",
            ...buildBackendProfileImplications(manifest.backend),
            ...scan.apiHints.map((value) => `API-related structure detected in ${value}.`)
          ],
          requiredOutputs: buildRequiredOutputs(
            context,
            buildBackendRequiredOutputs(manifest.backend)
          )
        })
      );
    case "docs/system/overview.md":
      return renderMergeManagedDocument(
        "System Overview",
        "system-overview",
        renderStructuredBody(context, {
          confirmedFacts: [
            manifest.systemType
              ? `System classification: ${manifest.systemType}.`
              : "System classification has not been selected yet.",
            ...buildSystemTypeImplications(manifest.systemType)
          ],
          requiredOutputs: buildRequiredOutputs(
            context,
            buildSystemRequiredOutputs(manifest.systemType)
          )
        })
      );
    case "docs/architecture/domain-boundaries.md":
      return renderMergeManagedDocument(
        "Domain Boundaries",
        "domain-boundaries",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...projectContext.coreEntities.map((value) => `Domain entity candidate: ${value}.`),
            ...buildArchitectureStyleImplications(manifest.architectureStyle)
          ],
          workingAssumptions: buildAssumptions(context, [
            manifest.practiceProfiles.includes("ddd-core")
              ? "Bounded contexts should be explicit before service boundaries are chosen."
              : "Domain boundaries can still be expressed as modules, ownership lines, or capability groups."
          ]),
          requiredOutputs: buildRequiredOutputs(context, [
            "Name the major domain boundaries, ownership seams, and coupling risks."
          ])
        })
      );
    case "docs/architecture/data-and-integrations.md":
      return renderMergeManagedDocument(
        "Data and Integrations",
        "data-integrations",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...scan.dataHints.map((value) => `Data hint: ${value}.`),
            ...manifest.constraints.map((value) => `Constraint impacting data/integrations: ${value}.`)
          ],
          openQuestions: buildOpenQuestionList(context, [
            "Which external systems, webhooks, or third-party APIs define critical interfaces?"
          ]),
          requiredOutputs: buildRequiredOutputs(context, buildDataAndIntegrationOutputs(context))
        })
      );
    case "docs/architecture/current-state.md":
      return renderMergeManagedDocument(
        "Current State",
        "current-state",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...buildScanFacts(scan),
            ...buildEngineeringSignals(scan),
            ...projectContext.currentPainPoints.map((value) => `Current pain point: ${value}.`)
          ],
          requiredOutputs: buildRequiredOutputs(context, buildCurrentStateOutputs(context))
        })
      );
    case "docs/architecture/refactor-target.md":
      return renderMergeManagedDocument(
        "Refactor Target",
        "refactor-target",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...buildSelectionFacts(context),
            ...projectContext.stabilityConstraints.map(
              (value) => `Stability constraint during migration: ${value}.`
            )
          ],
          requiredOutputs: buildRequiredOutputs(context, buildRefactorTargetOutputs(context))
        })
      );
    case "docs/architecture/decision-log.md":
      return renderMergeManagedDocument(
        "Decision Log",
        "decision-log",
        [
          "## Confirmed facts",
          "- This file is deprecated in the vNext docs contract.",
          `- Canonical decision tracking now lives in ${code("docs/decisions/index.md")}.`,
          "",
          "## Working assumptions",
          toBulletList(
            buildAssumptions(context, [
              "This shim should remain for one contract version so older references continue to resolve."
            ])
          ),
          "",
          "## Open questions",
          "- Which legacy references still point here and should be updated?",
          "",
          "## Required outputs",
          toBulletList([
            `Add new ADRs under ${code("docs/decisions/")}.`,
            "Update legacy references to point at the decision index or specific ADR files."
          ])
        ].join("\n")
      );
    case "docs/engineering/index.md":
      const engineeringPracticeDocs = buildActivePracticeDocLinks(manifest);
      return renderMergeManagedDocument(
        "Engineering Index",
        "engineering-index",
        [
          "## Confirmed facts",
          toBulletList([
            manifest.projectPhase === "existing"
              ? `Current delivery risks doc: ${code("docs/engineering/current-delivery-risks.md")}.`
              : `Testing strategy doc: ${code("docs/engineering/testing-strategy.md")}.`,
            `Delivery workflow doc: ${code("docs/engineering/delivery-workflow.md")}.`,
            manifest.projectPhase === "existing"
              ? `Testing strategy doc: ${code("docs/engineering/testing-strategy.md")}.`
              : `Verification doc: ${code("docs/engineering/verification.md")}.`,
            manifest.projectPhase === "existing"
              ? `Migration plan doc: ${code("docs/engineering/migration-plan.md")}.`
              : `Practice-aligned verification doc: ${code("docs/engineering/verification.md")}.`
          ]),
          "",
          "## Read next",
          toBulletList([
            ...(manifest.projectPhase === "existing"
              ? [
                  code("docs/engineering/current-delivery-risks.md"),
                  code("docs/engineering/migration-plan.md"),
                  code("docs/engineering/testing-strategy.md")
                ]
              : [code("docs/engineering/testing-strategy.md"), code("docs/engineering/verification.md")]),
            code("docs/engineering/delivery-workflow.md"),
            ...engineeringPracticeDocs
          ]),
          "",
          "## Focus",
          toBulletList([
            "Keep implementation expectations aligned with testing and verification docs.",
            "Escalate missing evidence or missing high-risk tests before implementation begins.",
            ...(engineeringPracticeDocs.length > 0
              ? [`Keep active practice guidance close at hand: ${engineeringPracticeDocs.join(", ")}.`]
              : [])
          ])
        ].join("\n")
      );
    case "docs/engineering/testing-strategy.md":
      return renderMergeManagedDocument(
        "Testing Strategy",
        "testing-strategy",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...scan.testHints.map((value) => `Detected testing signal: ${value}.`),
            ...manifest.constraints.map((value) => `Constraint with testing impact: ${value}.`)
          ],
          workingAssumptions: buildAssumptions(context, [
            manifest.practiceProfiles.includes("tdd-first")
              ? "High-risk behavior should be specified through tests before implementation moves ahead."
              : "The design should still call out the right test pyramid and verification boundaries."
          ]),
          requiredOutputs: buildRequiredOutputs(context, buildTestingOutputs(context))
        })
      );
    case "docs/engineering/current-delivery-risks.md":
      return renderMergeManagedDocument(
        "Current Delivery Risks",
        "current-delivery-risks",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...scan.testHints.map((value) => `Current validation signal: ${value}.`),
            ...scan.ciFiles.map((value) => `Current workflow file: ${value}.`),
            ...(Object.keys(scan.scripts).length > 0
              ? [
                  `Current package scripts: ${Object.entries(scan.scripts)
                    .map(([name, script]) => `${name} -> ${script}`)
                    .join("; ")}.`
                ]
              : []),
            ...projectContext.currentPainPoints.map((value) => `Pain point with delivery impact: ${value}.`)
          ],
          requiredOutputs: buildRequiredOutputs(context, buildCurrentRiskOutputs(context))
        })
      );
    case "docs/engineering/delivery-workflow.md":
      return renderMergeManagedDocument(
        "Delivery Workflow",
        "delivery-workflow",
        renderStructuredBody(context, {
          confirmedFacts: [
            `Package manager: ${scan.packageManager}.`,
            `Recommended install command for automation: ${scan.installCommand}.`,
            ...(Object.keys(scan.scripts).length > 0
              ? [
                  `Detected scripts: ${Object.entries(scan.scripts)
                    .map(([name, script]) => `${name} -> ${script}`)
                    .join("; ")}.`
                ]
              : ["No meaningful lint/test/build scripts were detected during setup."]),
            manifest.qualityProfiles.includes("ci-basic")
              ? "The `ci-basic` quality profile is selected for this repository."
              : "No CI quality profile is selected in the current foundation manifest.",
            ...(scan.ciFiles.length > 0
              ? [`Existing CI workflows: ${scan.ciFiles.join(", ")}.`]
              : [])
          ],
          requiredOutputs: buildRequiredOutputs(context, buildDeliveryOutputs(context))
        })
      );
    case "docs/engineering/migration-plan.md":
      return renderMergeManagedDocument(
        "Migration Plan",
        "migration-plan",
        renderStructuredBody(context, {
          confirmedFacts: [
            `Recommended install command for automation: ${scan.installCommand}.`,
            ...projectContext.stabilityConstraints.map(
              (value) => `Constraint currently treated as stable during migration: ${value}.`
            )
          ],
          requiredOutputs: buildRequiredOutputs(context, buildMigrationPlanOutputs(context))
        })
      );
    case "docs/engineering/verification.md":
      return renderMergeManagedDocument(
        "Verification",
        "verification",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...scan.testHints.map((value) => `Verification signal: ${value}.`),
            manifest.practiceProfiles.includes("strict-verification")
              ? "Strict verification is explicitly enabled."
              : "Strict verification is not explicitly enabled."
          ],
          requiredOutputs: buildRequiredOutputs(context, buildVerificationOutputs(context))
        })
      );
    case "docs/engineering/command-registry.md":
      return renderMergeManagedDocument(
        "Command Registry",
        "command-registry",
        [
          "## Confirmed facts",
          toBulletList([
            `Recommended install command: ${code(scan.installCommand)}.`,
            scan.workspaceLayout === "monorepo"
              ? "Repository scan detected a monorepo layout."
              : "Repository scan detected a single-package layout.",
            `Workflow timeline command: ${code("fortheagent history")} or the matching CLI history command.`,
            ...(Object.keys(scan.scripts).length > 0
              ? Object.entries(scan.scripts).map(
                  ([name, script]) => `Known script ${code(name)} -> ${code(script)}.`
                )
              : ["No meaningful package scripts were detected during setup."])
          ]),
          "",
          "## Required outputs",
          toBulletList([
            `Install: ${code(scan.installCommand)}`,
            `Dev: ${
              scan.scripts.dev
                ? code(buildRunCommand(scan.packageManager, "dev"))
                : "record the primary local-start command when it exists"
            }`,
            `Test: ${
              scan.scripts.test
                ? code(buildRunCommand(scan.packageManager, "test"))
                : "record the primary test command when it exists"
            }`,
            `Build: ${
              scan.scripts.build
                ? code(buildRunCommand(scan.packageManager, "build"))
                : "record the production build command when it exists"
            }`,
            `Review: ${code("fortheagent doctor")} or the matching CLI doctor command.`,
            `History: ${code("fortheagent history")} or the matching CLI history command.`,
            `Debug: ${code(buildDebugCommand(scan))}`
          ]),
          "",
          "## Expected outcomes",
          toBulletList(buildCommandRegistryExpectedOutcomes(context)),
          "",
          "## Subtree command focus",
          toBulletList(
            buildSubtreeCommandBullets(scan),
            "- no subtree-specific command focus was detected during setup"
          ),
          "",
          "## Working notes",
          "Keep expected outcomes, prerequisites, and environment assumptions next to each command as the repo matures. Prefer the narrowest subtree command when debugging."
        ].join("\n"),
        "## Team Notes"
      );
    case "docs/operations/index.md":
      return renderMergeManagedDocument(
        "Operations Index",
        "operations-index",
        [
          "## Confirmed facts",
          toBulletList([
            `Environment guide: ${code("docs/operations/environments.md")}.`,
            `Runbook guide: ${code("docs/operations/runbooks.md")}.`,
            "Secrets should not be stored in docs; only secret locations, environment variable names, and verification procedures belong here."
          ]),
          "",
          "## Read next",
          toBulletList([
            code("docs/operations/environments.md"),
            code("docs/operations/runbooks.md"),
            code("docs/engineering/command-registry.md")
          ]),
          "",
          "## Focus",
          toBulletList([
            "Keep operational knowledge separate from product or architecture narratives.",
            "Prefer actionable checks and runbooks over passive prose."
          ])
        ].join("\n")
      );
    case "docs/operations/environments.md":
      return renderMergeManagedDocument(
        "Environments",
        "operations-environments",
        renderStructuredBody(context, {
          confirmedFacts: [
            ...scan.importantFiles
              .filter((value) =>
                [
                  "Dockerfile",
                  "docker-compose.yml",
                  "vercel.json",
                  "supabase/config.toml",
                  "serverless.yml",
                  "serverless.ts"
                ].includes(value)
              )
              .map((value) => `Environment-related file detected: ${value}.`),
            scan.hasCi
              ? "A user-owned CI workflow already exists in this repository."
              : "No user-owned CI workflow was detected during scan."
          ],
          requiredOutputs: buildRequiredOutputs(context, [
            "Describe each real environment, the env vars or secret sources it depends on, and how operators verify that configuration is complete without storing secret values here."
          ])
        })
      );
    case "docs/operations/runbooks.md":
      return renderMergeManagedDocument(
        "Runbooks",
        "operations-runbooks",
        [
          "## Confirmed facts",
          toBulletList([
            ...scan.ciFiles.map((value) => `Existing workflow file: ${value}.`),
            ...scan.testHints.map((value) => `Validation signal relevant to runbooks: ${value}.`)
          ]),
          "",
          "## First responder draft",
          toBulletList(buildRunbookDraftBullets(context)),
          "",
          "## Required outputs",
          toBulletList(
            buildRequiredOutputs(context, [
              "Document the first responder path for deploy failures, broken tests, degraded integrations, and other high-risk operational issues."
            ])
          )
        ].join("\n")
      );
    case "docs/decisions/index.md":
      return renderMergeManagedDocument(
        "Decision Index",
        "decision-index",
        [
          "## Confirmed facts",
          toBulletList([
            `ADR template: ${code("docs/decisions/ADR-0001-template.md")}.`,
            `Legacy shim: ${code("docs/architecture/decision-log.md")}.`,
            ...(initialDecisionDocPath ? [`Initial decision draft: ${code(initialDecisionDocPath)}.`] : [])
          ]),
          "",
          "## Working assumptions",
          toBulletList([
            "High-impact architectural, operational, and workflow decisions should move into one-file-per-decision ADRs."
          ]),
          "",
          "## Open questions",
          toBulletList([
            initialDecisionDocPath
              ? "Which consequences from the initial baseline ADR should become more specific follow-up decisions?"
              : "Which current assumptions should be promoted into the first real ADR?"
          ]),
          "",
          "## Required outputs",
          toBulletList([
            "Create ADR-xxxx files as decisions become stable.",
            "Link decision consequences back to architecture, operations, and work docs."
          ])
        ].join("\n")
      );
    case "docs/decisions/ADR-0001-repository-baseline.md":
      return renderMergeManagedDocument(
        buildInitialDecisionTitle(manifest),
        "initial-decision-baseline",
        [
          "## Status",
          "Proposed",
          "",
          "## Context",
          ...toBulletList(
            unique([
              ...buildSelectionFacts(context),
              ...buildScanFacts(scan),
              ...buildEngineeringSignals(scan),
              ...projectContext.currentPainPoints.map((value) => `Pain point: ${value}.`),
              ...projectContext.stabilityConstraints.map(
                (value) => `Stability constraint: ${value}.`
              )
            ])
          ).split("\n"),
          "",
          "## Decision",
          ...toBulletList(
            unique([
              "Treat the currently detected repository shape as the working baseline while target-state design and migration planning are refined.",
              manifest.frontend
                ? `Keep the selected frontend posture (${manifest.frontend}) visible in future design and verification work unless a later ADR changes it.`
                : "",
              manifest.backend
                ? `Keep the selected backend posture (${manifest.backend}) visible in future design and verification work unless a later ADR changes it.`
                : "",
              manifest.systemType
                ? `Use the current system classification (${manifest.systemType}) as a working prompt for architecture, operations, and verification docs until a better framing is documented.`
                : "",
              `Record subsequent changes against ${code("docs/architecture/current-state.md")}, ${code("docs/architecture/refactor-target.md")}, and ${code("docs/engineering/migration-plan.md")}.`
            ])
          ).split("\n"),
          "",
          "## Consequences",
          ...toBulletList(
            unique([
              "Migration planning should usually preserve the stated stability constraints until a later ADR explicitly changes them.",
              "Operational scripts and CI workflows should stay usable while the target architecture is clarified.",
              "Future ADRs should refine or replace this working baseline once the first concrete migration boundary is accepted."
            ])
          ).split("\n"),
          ""
        ].join("\n")
      );
    case "docs/decisions/ADR-0001-template.md":
      return renderManagedDocument(
        "ADR-0001 Template",
        [
          "## Status",
          "Proposed",
          "",
          "## Context",
          "Describe the forces, constraints, and repository facts that make this decision necessary.",
          "",
          "## Decision",
          "Describe the chosen option in plain language.",
          "",
          "## Consequences",
          "Describe what becomes easier, harder, or riskier because of this choice.",
          ""
        ].join("\n")
      );
    case "docs/work/index.md":
      return renderMergeManagedDocument(
        "Work Index",
        "work-index",
        [
          "## Confirmed facts",
          toBulletList([
            `Current handoff: ${code(".agent-foundation/handoffs/current.md")}.`,
            ...(activeWorkItemPath ? [`Current active work item: ${code(activeWorkItemPath)}.`] : []),
            `Workflow timeline command: ${code("fortheagent history")} or the matching CLI history command.`,
            "Active work items should live under `docs/work/active/`.",
            "Plans should live under `docs/work/plans/` and reviews under `docs/work/reviews/`."
          ]),
          "",
          "## Required outputs",
          toBulletList([
            "Keep only currently actionable work in `docs/work/active/`.",
            "Move completed or obsolete work to `docs/work/archive/`.",
            "Keep manifest workflow state aligned with any active work item file.",
            `Use ${code("fortheagent work --archive-active --active-work-item <next>")} or the matching CLI workflow command to close active work without losing handoff history.`
          ]),
          "",
          "## Team Notes",
          "Add links to active work items here when the repository moves beyond initial setup."
        ].join("\n"),
        "## Team Notes"
      );
    case "docs/work/active/0001-initial-design-scope.md":
    case "docs/work/active/0001-repository-baseline-and-target.md":
      return renderMergeManagedDocument(
        buildActiveWorkItemHeading(repositoryPath, manifest),
        "active-work-item",
        [
          "## Objective",
          buildActiveWorkItemObjective(manifest, repositoryPath),
          "",
          "## Inputs",
          toBulletList(
            unique([
              code("docs/agents/repo-facts.md"),
              code("docs/index.md"),
              code(".agent-foundation/handoffs/current.md"),
              manifest.projectPhase === "existing"
                ? code("docs/architecture/current-state.md")
                : code("docs/product/problem-and-users.md"),
              manifest.projectPhase === "existing"
                ? code("docs/architecture/refactor-target.md")
                : code("docs/architecture/overview.md"),
              ...(initialDecisionDocPath ? [code(initialDecisionDocPath)] : [])
            ])
          ),
          "",
          "## Deliverables",
          toBulletList(buildActiveWorkItemDeliverables(manifest, repositoryPath)),
          "",
          "## Verification",
          toBulletList(buildVerificationCommandBullets(scan)),
          "",
          "## Exit Criteria",
          toBulletList([
            "The handoff, work index, and command registry all point to the same current task shape.",
            "At least one decision, verification expectation, and next concrete follow-up are written down.",
            "The next agent can continue from this file without re-reading the full docs tree."
          ])
        ].join("\n")
      );
    case "docs/rules/index.md":
      return renderMergeManagedDocument(
        "Rules Index",
        "rules-index",
        [
          "## Confirmed facts",
          toBulletList([
            `Coding rules: ${code("docs/rules/coding.md")}.`,
            `Review rules: ${code("docs/rules/review.md")}.`,
            `Testing rules: ${code("docs/rules/testing.md")}.`,
            `Documentation rules: ${code("docs/rules/documentation.md")}.`
          ]),
          "",
          "## Working assumptions",
          toBulletList(buildAssumptions(context, ["Rules should optimize for design clarity and implementation safety, not ceremony."])),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which local rules override generic engineering defaults?"])),
          "",
          "## Required outputs",
          toBulletList(["Keep rules concise, enforceable, and aligned with the generated design pack."])
        ].join("\n")
      );
    case "docs/rules/coding.md":
      return renderMergeManagedDocument(
        "Coding Rules",
        "coding-rules",
        [
          "## Confirmed facts",
          toBulletList([
            "Generated foundation docs are part of the repository contract.",
            ...manifest.practiceProfiles.map((value) => `Active practice profile: ${value}.`)
          ]),
          "",
          "## Working assumptions",
          toBulletList(buildAssumptions(context, ["Prefer small, reviewable changes that preserve the generated repository contract."])),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which implementation areas are most likely to require tighter coding constraints?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Preserve managed files unless the foundation contract explicitly allows local edits.",
            "Keep design and code terminology aligned.",
            "Prefer changes that leave clear verification evidence."
          ])
        ].join("\n")
      );
    case "docs/rules/review.md":
      return renderMergeManagedDocument(
        "Review Rules",
        "review-rules",
        [
          "## Confirmed facts",
          toBulletList([
            "Repository health and contract drift are review concerns.",
            manifest.practiceProfiles.includes("strict-verification")
              ? "Strict verification is active for review expectations."
              : "Strict verification is not explicitly selected."
          ]),
          "",
          "## Working assumptions",
          toBulletList(buildAssumptions(context, ["Reviews should prioritize regressions, drift, and missing proof before polish."])),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["What project-specific risks deserve explicit review checklists?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Call out regressions and contract violations first.",
            "Treat missing verification evidence as a review issue.",
            "Treat missing or stale foundation docs as repository health issues."
          ])
        ].join("\n")
      );
    case "docs/rules/testing.md":
      return renderMergeManagedDocument(
        "Testing Rules",
        "testing-rules",
        [
          "## Confirmed facts",
          toBulletList([
            ...scan.testHints.map((value) => `Testing signal: ${value}.`),
            ...manifest.constraints.map((value) => `Constraint affecting tests: ${value}.`)
          ]),
          "",
          "## Working assumptions",
          toBulletList(buildAssumptions(context, [
            manifest.practiceProfiles.includes("tdd-first")
              ? "High-risk changes should follow a red-green-refactor flow."
              : "Tests should still be designed intentionally around behavior and risk."
          ])),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which behaviors are too risky to ship without integration or acceptance tests?"])),
          "",
          "## Required outputs",
          toBulletList([
            manifest.practiceProfiles.includes("tdd-first")
              ? "Write or describe failing tests before implementation for the highest-risk behavior."
              : "Document the expected test layers before implementation.",
            "Cover critical constraints such as payments, auth, and PII with explicit scenarios when they apply.",
            "Do not claim success without fresh verification evidence."
          ])
        ].join("\n")
      );
    case "docs/rules/documentation.md":
      return renderMergeManagedDocument(
        "Documentation Rules",
        "documentation-rules",
        [
          "## Confirmed facts",
          toBulletList(["The generated design docs are part of the working system of record."]),
          "",
          "## Working assumptions",
          toBulletList(buildAssumptions(context, ["Documentation should be updated in place as design decisions become clearer."])),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which docs should become canonical references for future implementation work?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Update generated design docs instead of creating parallel, hidden notes.",
            "Label facts, assumptions, and open questions clearly.",
            "Use concise English-first wording."
          ])
        ].join("\n")
      );
    case "docs/skills/index.md": {
      const allRecommendedSkills = buildRecommendedSkillNames(context, "all");
      const installedRecommendedSkills = buildInstalledSkillNames(context, allRecommendedSkills);
      const missingRecommendedSkills = buildMissingSkillNames(context, allRecommendedSkills);
      const repoLocalSkills = [
        ".agents/skills/docs-writer/SKILL.md",
        ".agents/skills/repo-review/SKILL.md",
        ".agents/skills/verification/SKILL.md",
        ".agents/skills/architecture-brief/SKILL.md"
      ];
      return renderMergeManagedDocument(
        "Skills Index",
        "skills-index",
        [
          "## Confirmed facts",
          toBulletList([
            `Design skill guide: ${code("docs/skills/design.md")}.`,
            `Testing skill guide: ${code("docs/skills/testing.md")}.`,
            `Research skill guide: ${code("docs/skills/research.md")}.`,
            `Recommended skills for this repo: ${allRecommendedSkills.join(", ") || "none"}.`,
            `Repository-local skills available on demand: ${repoLocalSkills.map((value) => code(value)).join(", ")}.`,
            installedRecommendedSkills.length > 0
              ? `Recommended skills already installed locally: ${installedRecommendedSkills.join(", ")}.`
              : "No recommended skills were detected in the current local environment.",
            scan.hasSkillInstaller
              ? "A local skill installer is available if additional skills are needed."
              : "No local skill installer was detected in this environment."
          ]),
          "",
          "## Working assumptions",
          toBulletList(
            buildAssumptions(context, [
              "Skills should help agents operate consistently inside this repository contract.",
              "Agents should prefer installed local skills before improvising stack-specific guidance."
            ])
          ),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which domain- or stack-specific skills should be added next?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Use design, testing, and research skills in combination with the generated rules.",
            "Treat the repository-local skills as task-specific capability packs rather than always-loaded startup context.",
            buildSkillInstallerGuidance(
              context,
              allRecommendedSkills,
              "If repo-recommended skills are still insufficient, explicitly propose the local `skill-installer` workflow before deep work starts.",
              "If a recommended skill is unavailable, say so explicitly before proceeding without it."
            ),
            "Extend this index when project-specific skills become real and reusable."
          ])
        ].join("\n")
      );
    }
    case "docs/skills/design.md": {
      const designSkills = buildRecommendedSkillNames(context, "design");
      return renderMergeManagedDocument(
        "Design Skill Guide",
        "skill-design",
        [
          "## Confirmed facts",
          toBulletList([
            ...buildSelectionFacts(context),
            `Recommended design skills: ${designSkills.join(", ") || "none"}.`,
            ...buildInstalledSkillNames(context, designSkills).map(
              (skill) => `Installed design skill available locally: ${skill}.`
            )
          ]),
          "",
          "## Working assumptions",
          toBulletList(
            buildAssumptions(context, [
              "Agents should start from domain, constraints, and architecture before implementation detail.",
              "When a stack-specific design skill exists locally, it should be used before writing fresh guidance."
            ])
          ),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which design artifacts are required before coding begins?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Use the product and architecture docs as the main design workspace.",
            "Prefer named design skills for stack-specific decisions before improvising repository guidance.",
            "Open `.agents/skills/architecture-brief/SKILL.md` or `.agents/skills/docs-writer/SKILL.md` when the task is specifically about architecture or document authoring.",
            buildSkillInstallerGuidance(
              context,
              designSkills,
              "If the current design skill set is too thin, explicitly propose the local `skill-installer` workflow before improvising stack guidance.",
              "If a useful design skill is unavailable, say so before falling back to generic stack guidance."
            ),
            "Expand decision logs as tradeoffs become concrete."
          ])
        ].join("\n")
      );
    }
    case "docs/skills/testing.md": {
      const testingSkills = buildRecommendedSkillNames(context, "testing");
      return renderMergeManagedDocument(
        "Testing Skill Guide",
        "skill-testing",
        [
          "## Confirmed facts",
          toBulletList([
            ...scan.testHints.map((value) => `Detected test signal: ${value}.`),
            ...manifest.practiceProfiles.map((value) => `Practice profile with testing impact: ${value}.`),
            `Recommended testing skills: ${testingSkills.join(", ") || "none"}.`,
            ...buildInstalledSkillNames(context, testingSkills).map(
              (skill) => `Installed testing skill available locally: ${skill}.`
            )
          ]),
          "",
          "## Working assumptions",
          toBulletList(
            buildAssumptions(context, [
              "Testing guidance should scale from design review to implementation verification.",
              "When verification- or test-oriented skills are available, they should shape the first test plan."
            ])
          ),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which test layers are mandatory for the first milestone?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Translate risks and constraints into concrete test scenarios.",
            "Open `.agents/skills/verification/SKILL.md` when the task is mainly about proof, validation, or acceptance criteria.",
            buildSkillInstallerGuidance(
              context,
              testingSkills,
              "If the current testing skill set is too thin, explicitly propose the local `skill-installer` workflow before large QA or verification work.",
              "If a recommended testing skill is missing, propose installation before large verification or QA work."
            ),
            "Keep the test plan aligned with the generated verification and review rules."
          ])
        ].join("\n")
      );
    }
    case "docs/skills/research.md": {
      const researchSkills = buildRecommendedSkillNames(context, "research");
      return renderMergeManagedDocument(
        "Research Skill Guide",
        "skill-research",
        [
          "## Confirmed facts",
          toBulletList([
            ...buildRepoFactsBullets(context),
            `Recommended research skills: ${researchSkills.join(", ") || "none"}.`,
            ...buildInstalledSkillNames(context, researchSkills).map(
              (skill) => `Installed research skill available locally: ${skill}.`
            )
          ]),
          "",
          "## Working assumptions",
          toBulletList(
            buildAssumptions(context, [
              "Repository research should reduce ambiguity before implementation decisions are made.",
              "Agents should use available research skills before falling back to generic repository spelunking."
            ])
          ),
          "",
          "## Open questions",
          toBulletList(buildOpenQuestionList(context, ["Which assumptions still need repository or stakeholder validation?"])),
          "",
          "## Required outputs",
          toBulletList([
            "Use scan results as facts and add source-backed findings into the design docs.",
            "Open `.agents/skills/repo-review/SKILL.md` when the task is to assess repository state, drift, or missing context.",
            buildSkillInstallerGuidance(
              context,
              researchSkills,
              "If the current research skill set is too thin, explicitly propose the local `skill-installer` workflow before large exploratory work.",
              "If a useful research skill is missing, say so before large exploratory work."
            ),
            "Prefer explicit citations to repo structure or existing code when possible."
          ])
        ].join("\n")
      );
    }
    case "docs/practices/ddd-core.md":
    case "docs/practices/tdd-first.md":
    case "docs/practices/strict-verification.md": {
      const practice = path.basename(repositoryPath, ".md");
      return renderMergeManagedDocument(
        `Practice: ${practice}`,
        `practice-${practice}`,
        renderStructuredBody(context, {
          confirmedFacts: buildPracticeImplications(practice),
          requiredOutputs: buildRequiredOutputs(context, [
            `Apply the ${practice} practice consistently across design and review docs.`
          ])
        })
      );
    }
    case "docs/product/constraints/seo.md":
    case "docs/product/constraints/auth.md":
    case "docs/product/constraints/payments.md":
    case "docs/product/constraints/multi-tenant.md":
    case "docs/product/constraints/pii.md":
    case "docs/product/constraints/offline.md":
    case "docs/product/constraints/realtime.md": {
      const constraint = path.basename(repositoryPath, ".md");
      return renderMergeManagedDocument(
        `Constraint: ${constraint}`,
        `constraint-${constraint}`,
        renderStructuredBody(context, {
          confirmedFacts: buildConstraintImplications(context, constraint),
          requiredOutputs: buildRequiredOutputs(context, [
            `Make the ${constraint} constraint visible in product, architecture, and testing decisions.`
          ])
        })
      );
    }
    case ".github/workflows/ci.yml":
      return `${buildCiWorkflow(scan)}\n`;
    case ".agents/skills/docs-writer/SKILL.md":
      return renderManagedDocument(
        "Docs Writer Skill",
        [
          "Use when the task is to write or refresh repository documentation inside the generated foundation.",
          "",
          "Workflow:",
          toBulletList([
            "Start from `docs/index.md`, `docs/agents/repo-facts.md`, and the relevant scoped doc.",
            "Preserve the Confirmed facts / Working assumptions / Open questions / Required outputs structure when it already exists.",
            "Prefer updating existing canonical docs over creating new side documents."
          ])
        ].join("\n")
      );
    case ".agents/skills/repo-review/SKILL.md":
      return renderManagedDocument(
        "Repo Review Skill",
        [
          "Use when the task is to assess repository health, drift, or missing design context.",
          "",
          "Workflow:",
          toBulletList([
            "Check manifest state, generated docs coverage, and managed-file drift first.",
            "Review root entry files, rules, and skills for context efficiency issues before deeper nitpicks.",
            "Report findings in descending risk order with explicit file references."
          ])
        ].join("\n")
      );
    case ".agents/skills/verification/SKILL.md":
      return renderManagedDocument(
        "Verification Skill",
        [
          "Use when a task requires proof, validation, or acceptance evidence rather than new design content.",
          "",
          "Workflow:",
          toBulletList([
            "Start from `docs/engineering/verification.md` and `docs/rules/testing.md`.",
            "Identify the command or artifact that proves the claim before making the claim.",
            "Treat missing evidence as a repository quality issue, not a style preference."
          ])
        ].join("\n")
      );
    case ".agents/skills/architecture-brief/SKILL.md":
      return renderManagedDocument(
        "Architecture Brief Skill",
        [
          "Use when the task is to summarize system shape, boundaries, or architectural tradeoffs quickly.",
          "",
          "Workflow:",
          toBulletList([
            "Read `docs/architecture/overview.md`, `docs/architecture/domain-boundaries.md`, and `docs/architecture/data-and-integrations.md` first.",
            "Separate confirmed boundaries from assumptions or open decisions.",
            "Write concise architecture briefs that point back to the canonical docs instead of replacing them."
          ])
        ].join("\n")
      );
    default: {
      if (repositoryPath.startsWith("docs/work/active/")) {
        return renderMergeManagedDocument(
          buildActiveWorkItemHeading(repositoryPath, manifest),
          "active-work-item",
          [
            "## Objective",
            buildActiveWorkItemObjective(manifest, repositoryPath),
            "",
            "## Inputs",
            toBulletList(
              unique([
                code("docs/agents/repo-facts.md"),
                code("docs/work/index.md"),
                code(".agent-foundation/handoffs/current.md"),
                code("docs/engineering/command-registry.md"),
                ...(manifest.projectPhase === "existing"
                  ? [code("docs/architecture/current-state.md"), code("docs/architecture/refactor-target.md")]
                  : [code("docs/product/problem-and-users.md"), code("docs/architecture/overview.md")]),
                ...(initialDecisionDocPath ? [code(initialDecisionDocPath)] : [])
              ])
            ),
            "",
            "## Deliverables",
            toBulletList(buildActiveWorkItemDeliverables(manifest, repositoryPath)),
            "",
            "## Verification",
            toBulletList(buildVerificationCommandBullets(scan)),
            "",
            "## Exit Criteria",
            toBulletList([
              "The handoff, work index, and command registry all point to the same current task shape.",
              "Open questions, blockers, and next steps are explicit enough for another agent to continue from this file.",
              "The active work item stays narrower than the full repository contract."
            ])
          ].join("\n")
        );
      }

      if (classifyFile(repositoryPath) === "merge-managed") {
        return renderMergeManagedDocument(
          path.basename(repositoryPath, ".md"),
          "generic-foundation",
          renderStructuredBody(context, {
            confirmedFacts: buildSelectionFacts(context)
          })
        );
      }

      return renderManagedDocument(
        path.basename(repositoryPath, path.extname(repositoryPath)),
        renderStructuredBody(context, {
          confirmedFacts: buildSelectionFacts(context)
        })
      );
    }
  }
}

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runInit } from "../../src/commands/init.js";

describe("runInit", () => {
  it.each([
    {
      label: "content-site",
      frontend: "next",
      backend: "none",
      systemType: "content-site",
      architectureStyle: "monolith",
      expectedOverview: "Publishing flow, discoverability, and content modeling are likely first-order concerns.",
      expectedProblem:
        "editorial workflow, publishing latency expectations, content ownership, and how discoverability affects success",
      expectedData:
        "CMS or content-source boundaries, preview flows, metadata ownership, and how cache invalidation or revalidation keeps published content fresh",
      expectedDelivery:
        "preview or staging review for content changes, metadata validation, and performance checks for critical entry pages",
      expectedTesting:
        "preview, publish, metadata, search-index, and broken-link tests for the highest-value content paths",
      expectedVerification:
        "metadata quality, preview or publish transitions, and delivery performance on key content surfaces",
      expectedSkill: "frontend-design"
    },
    {
      label: "api-platform",
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented",
      expectedOverview: "External or internal API consumers are likely the main product surface.",
      expectedProblem:
        "primary API consumers, their core jobs, integration expectations, and the operational guarantees they care about",
      expectedData:
        "contract ownership, versioning posture, idempotency requirements, rate limits, and webhook or callback boundaries",
      expectedDelivery:
        "contract review, auth or permission review, observability checks, and backward-compatibility gates before rollout",
      expectedTesting:
        "contract compatibility, auth enforcement, idempotency, and error-shape coverage for consumer-facing endpoints",
      expectedVerification:
        "backward-compatible contracts, auth behavior, observability, and failure-mode coverage for external consumers",
      expectedSkill: "api-design-principles"
    },
    {
      label: "realtime-app",
      frontend: "react-spa",
      backend: "fastify",
      systemType: "realtime-app",
      architectureStyle: "event-driven",
      expectedOverview: "Live collaboration or fast state propagation is likely central to the product.",
      expectedProblem:
        "moments where live collaboration, presence, or low-latency updates materially change the user experience",
      expectedData:
        "channel or topic topology, ordering guarantees, reconnect or recovery behavior, and duplicate-suppression boundaries",
      expectedDelivery:
        "live-flow changes are staged, how reconnect or load behavior is checked, and what rollback signals matter most",
      expectedTesting:
        "event ordering, reconnect, presence, duplicate-delivery, and degraded-network scenarios for live flows",
      expectedVerification:
        "reconnect behavior, ordering guarantees, presence accuracy, and degraded-network handling",
      expectedSkill: "systematic-debugging"
    },
    {
      label: "data-platform",
      frontend: "none",
      backend: "serverless",
      systemType: "data-platform",
      architectureStyle: "event-driven",
      expectedOverview: "Data ingestion, processing, lineage, or analytics are likely core system concerns.",
      expectedProblem:
        "data producers, downstream consumers, freshness expectations, and the business decisions blocked by low-quality data",
      expectedData:
        "ingestion stages, transformation ownership, lineage visibility, replay or backfill boundaries, and data-quality checkpoints",
      expectedDelivery:
        "migration windows, replay or backfill rehearsal, data-quality gates, and how downstream consumers are protected during rollout",
      expectedTesting:
        "ingestion validation, schema evolution, replay or backfill safety, and data-quality checks for critical pipelines",
      expectedVerification:
        "lineage visibility, replay or backfill behavior, schema change handling, and data-quality monitoring hooks",
      expectedSkill: "supabase-postgres-best-practices"
    }
  ])(
    "writes differentiated outputs for $label repositories",
    async ({
      frontend,
      backend,
      systemType,
      architectureStyle,
      expectedOverview,
      expectedProblem,
      expectedData,
      expectedDelivery,
      expectedTesting,
      expectedVerification,
      expectedSkill
    }) => {
      const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

      await runInit({
        cwd,
        frontend,
        backend,
        systemType,
        architectureStyle
      });

      await expect(
        readFile(path.join(cwd, "docs", "system", "overview.md"), "utf8")
      ).resolves.toContain(expectedOverview);
      await expect(
        readFile(path.join(cwd, "docs", "product", "problem-and-users.md"), "utf8")
      ).resolves.toContain(expectedProblem);
      await expect(
        readFile(path.join(cwd, "docs", "architecture", "data-and-integrations.md"), "utf8")
      ).resolves.toContain(expectedData);
      await expect(
        readFile(path.join(cwd, "docs", "engineering", "delivery-workflow.md"), "utf8")
      ).resolves.toContain(expectedDelivery);
      await expect(
        readFile(path.join(cwd, "docs", "engineering", "testing-strategy.md"), "utf8")
      ).resolves.toContain(expectedTesting);
      await expect(
        readFile(path.join(cwd, "docs", "engineering", "verification.md"), "utf8")
      ).resolves.toContain(expectedVerification);
      await expect(
        readFile(path.join(cwd, "docs", "skills", "index.md"), "utf8")
      ).resolves.toContain(expectedSkill);
    }
  );

  it("creates the base foundation in deferred mode", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await runInit({ cwd, mode: "deferred" });

    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/index.md"
    );
    await expect(readFile(path.join(cwd, "GEMINI.md"), "utf8")).resolves.toContain(
      "docs/index.md"
    );
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"unresolved\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "profile-registry.json"), "utf8")
    ).resolves.toContain("\"frontend\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "context-budget.json"), "utf8")
    ).resolves.toContain("\"AGENTS.md\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "provider-projections.json"), "utf8")
    ).resolves.toContain("\"entryFile\": \"GEMINI.md\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "doc-index.json"), "utf8")
    ).resolves.toContain("\"path\": \"docs/index.md\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "doc-health.json"), "utf8")
    ).resolves.toContain("\"reachableFromStartup\": true");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoffs", "current.md"), "utf8")
    ).resolves.toContain("## Active Work Item");
    await expect(
      readFile(path.join(cwd, ".agents", "skills", "docs-writer", "SKILL.md"), "utf8")
    ).resolves.toContain("Docs Writer Skill");
    await expect(
      readFile(path.join(cwd, ".claude", "rules", "index.md"), "utf8")
    ).resolves.toContain("Claude Rules Index");
    await expect(
      readFile(path.join(cwd, ".cursor", "rules", "architecture.mdc"), "utf8")
    ).resolves.toContain("Architecture rule");
    await expect(readFile(path.join(cwd, "docs", "index.md"), "utf8")).resolves.toContain(
      "\"doc_type\": \"document\""
    );
  });

  it("creates current-state and migration docs for existing repositories without overwriting README", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-existing-"));

    await mkdir(path.join(cwd, "src", "routes"), { recursive: true });
    await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "existing-demo",
          scripts: {
            test: "vitest run"
          },
          dependencies: {
            fastify: "^5.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(cwd, "README.md"), "# Existing Repo\n\nKeep this.\n", "utf8");
    await writeFile(
      path.join(cwd, ".github", "workflows", "release.yml"),
      "name: release\non: push\n",
      "utf8"
    );

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented",
      projectContext: {
        currentPainPoints: ["fragile contracts", "unclear ownership"],
        stabilityConstraints: ["keep existing API routes stable"]
      }
    });

    await expect(readFile(path.join(cwd, "README.md"), "utf8")).resolves.toBe(
      "# Existing Repo\n\nKeep this.\n"
    );
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "current-state.md"), "utf8")
    ).resolves.toContain("Meaningful package scripts: test -> vitest run.");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "refactor-target.md"), "utf8")
    ).resolves.toContain("target architecture");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "current-delivery-risks.md"), "utf8")
    ).resolves.toContain("current delivery risks");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "migration-plan.md"), "utf8")
    ).resolves.toContain("Recommended install command for automation: npm install.");
    await expect(
      readFile(path.join(cwd, "docs", "product", "problem-and-users.md"), "utf8")
    ).resolves.toContain("fragile contracts");
    await expect(
      readFile(path.join(cwd, "docs", "agents", "repo-facts.md"), "utf8")
    ).resolves.toContain(".github/workflows/release.yml");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"projectPhase\": \"existing\"");
  });

  it("creates resolved overlay files when selections are provided", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      qualityProfiles: ["ci-basic"]
    });

    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("next");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "backend.md"), "utf8")
    ).resolves.toContain("nest");
    await expect(
      readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8")
    ).resolves.toContain("name: CI");
    await expect(
      readFile(path.join(cwd, ".claude", "rules", "frontend.md"), "utf8")
    ).resolves.toContain("Claude Rule: Frontend");
    await expect(
      readFile(path.join(cwd, ".cursor", "rules", "frontend.mdc"), "utf8")
    ).resolves.toContain("Frontend rule");
    await expect(
      readFile(path.join(cwd, ".claude", "rules", "payments.md"), "utf8")
    ).rejects.toThrow();
    await expect(
      readFile(path.join(cwd, ".cursor", "rules", "payments.mdc"), "utf8")
    ).rejects.toThrow();
  });

  it("supports non-default product shapes when implemented profiles are selected", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await runInit({
      cwd,
      frontend: "react-spa",
      backend: "fastify",
      systemType: "b2b-saas",
      architectureStyle: "service-oriented"
    });

    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("react-spa");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "backend.md"), "utf8")
    ).resolves.toContain("fastify");
    await expect(
      readFile(path.join(cwd, "docs", "system", "overview.md"), "utf8")
    ).resolves.toContain("b2b-saas");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "domain-boundaries.md"), "utf8")
    ).resolves.toContain(
      "The selected architecture currently suggests multiple services with explicit contracts."
    );
    await expect(
      readFile(path.join(cwd, ".cursor", "rules", "frontend.mdc"), "utf8")
    ).resolves.toContain("Frontend rule");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "testing-strategy.md"), "utf8")
    ).resolves.toContain("schema-backed handlers");
  });

  it("writes modern Next.js-oriented guidance for the default web stack", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["ddd-core", "tdd-first", "strict-verification"]
    });

    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("Server/Client Component boundaries");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("route handlers or server-side actions");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "testing-strategy.md"), "utf8")
    ).resolves.toContain("route-level tests for loading, error, and mutation flows");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "verification.md"), "utf8")
    ).resolves.toContain("cache or revalidation behavior");
    await expect(
      readFile(path.join(cwd, "docs", "skills", "index.md"), "utf8")
    ).resolves.toContain("next-best-practices");
    await expect(
      readFile(path.join(cwd, "docs", "skills", "index.md"), "utf8")
    ).resolves.toContain("github-actions-templates");
  });

  it("surfaces realtime tool hints in repo facts and design docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "realtime-demo",
          dependencies: {
            ably: "^2.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await runInit({
      cwd,
      frontend: "react-spa",
      backend: "fastify",
      systemType: "realtime-app",
      architectureStyle: "event-driven"
    });

    await expect(
      readFile(path.join(cwd, "docs", "agents", "repo-facts.md"), "utf8")
    ).resolves.toContain("Realtime tooling hints: ably.");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "data-and-integrations.md"), "utf8")
    ).resolves.toContain("Ably channel strategy, presence usage, message ordering expectations");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "testing-strategy.md"), "utf8")
    ).resolves.toContain("channel resume or recovery tests, presence accuracy checks");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "verification.md"), "utf8")
    ).resolves.toContain("connection recovery, channel resume behavior, and presence state convergence");
  });

  it("surfaces data tooling hints in repo facts and design docs", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await mkdir(path.join(cwd, "supabase"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "data-demo",
          dependencies: {
            "drizzle-orm": "^0.0.0",
            "@supabase/supabase-js": "^2.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(cwd, "drizzle.config.ts"), "export default {};\n", "utf8");
    await writeFile(path.join(cwd, "supabase", "config.toml"), "project_id = \"demo\"\n", "utf8");

    await runInit({
      cwd,
      frontend: "none",
      backend: "serverless",
      systemType: "data-platform",
      architectureStyle: "event-driven"
    });

    await expect(
      readFile(path.join(cwd, "docs", "agents", "repo-facts.md"), "utf8")
    ).resolves.toContain("Data tooling hints: drizzle, supabase.");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "data-and-integrations.md"), "utf8")
    ).resolves.toContain("Supabase or Postgres ownership, migration flow, policy or access boundaries");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "data-and-integrations.md"), "utf8")
    ).resolves.toContain("Drizzle schema definitions, migrations, and query contracts");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "testing-strategy.md"), "utf8")
    ).resolves.toContain("migration smoke tests, query-performance checks, and policy or access-control validation");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "verification.md"), "utf8")
    ).resolves.toContain("generated migrations and typed query usage stay aligned");
  });

  it("ignores placeholder npm init test scripts when generating ci-basic", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "demo",
          version: "1.0.0",
          scripts: {
            test: 'echo "Error: no test specified" && exit 1'
          }
        },
        null,
        2
      ),
      "utf8"
    );

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      qualityProfiles: ["ci-basic"]
    });

    const ci = await readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8");
    const testingStrategy = await readFile(
      path.join(cwd, "docs", "engineering", "testing-strategy.md"),
      "utf8"
    );
    const repoFacts = await readFile(
      path.join(cwd, "docs", "agents", "repo-facts.md"),
      "utf8"
    );

    expect(ci).not.toContain("npm test");
    expect(ci).toContain("No lint/test/build scripts detected during foundation setup.");
    expect(testingStrategy).not.toContain("no test specified");
    expect(repoFacts).not.toContain("no test specified");
    expect(ci).toContain("npm install");
    expect(ci).not.toContain("npm ci");
  });

  it("uses npm ci only when a package lock is present", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-ci-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "demo",
          version: "1.0.0",
          scripts: {
            build: "tsc -p tsconfig.json"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(cwd, "package-lock.json"), "{\n  \"name\": \"demo\"\n}\n", "utf8");

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      qualityProfiles: ["ci-basic"]
    });

    const ci = await readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8");
    expect(ci).toContain("npm ci");
    expect(ci).toContain("npm run build");
  });

  it("fails on first init when an existing target file would be overwritten", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await mkdir(path.join(cwd, "docs", "architecture"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "architecture", "overview.md"), "custom\n", "utf8");

    await expect(runInit({ cwd, mode: "deferred" })).rejects.toThrow(
      "Existing files would be overwritten: docs/architecture/overview.md"
    );
  });

  it("allows merge-managed files on first init when markers are valid", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await writeFile(
      path.join(cwd, "AGENTS.md"),
      [
        "# Repo Notes",
        "",
        "<!-- agent-foundation:begin section=\"startup-sequence\" -->",
        "Old managed content.",
        "<!-- agent-foundation:end section=\"startup-sequence\" -->",
        "",
        "Local note stays."
      ].join("\n"),
      "utf8"
    );

    await runInit({ cwd, mode: "deferred" });

    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/index.md"
    );
    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "Local note stays."
    );
  });

  it("detects the repository root from a nested working directory", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));
    const nestedCwd = path.join(cwd, "apps", "web");

    await mkdir(nestedCwd, { recursive: true });
    await writeFile(path.join(cwd, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
    await writeFile(path.join(nestedCwd, "package.json"), "{\"name\":\"web\"}\n", "utf8");

    await runInit({ cwd: nestedCwd, mode: "deferred" });

    await expect(readFile(path.join(cwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/index.md"
    );
    await expect(readFile(path.join(nestedCwd, "AGENTS.md"), "utf8")).resolves.toContain(
      "docs/architecture/areas/apps--web.md"
    );
  });

  it("creates an initial active work item for resolved repositories", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await runInit({
      cwd,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith"
    });

    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain(
      "\"activeWorkItem\": \"docs/work/active/0001-initial-design-scope.md\""
    );
    await expect(
      readFile(
        path.join(cwd, "docs", "work", "active", "0001-initial-design-scope.md"),
        "utf8"
      )
    ).resolves.toContain("Initial Design Scope");
    await expect(readFile(path.join(cwd, "docs", "index.md"), "utf8")).resolves.toContain(
      "docs/work/active/0001-initial-design-scope.md"
    );
  });

  it("creates a baseline ADR, runbook draft, and subtree commands for existing monorepos", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-existing-mono-"));

    await mkdir(path.join(cwd, "apps", "web", "src", "app"), { recursive: true });
    await mkdir(path.join(cwd, "services", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(cwd, "services", "api", "tests"), { recursive: true });
    await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "signal-ops",
          private: true,
          workspaces: ["apps/*", "services/*"],
          scripts: {
            build: "npm run build --workspaces",
            test: "npm run test --workspaces"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "apps", "web", "package.json"),
      JSON.stringify(
        {
          name: "@signal-ops/web",
          scripts: {
            build: "next build"
          },
          dependencies: {
            next: "^16.0.0",
            react: "^19.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "services", "api", "package.json"),
      JSON.stringify(
        {
          name: "@signal-ops/api",
          scripts: {
            test: "vitest run"
          },
          dependencies: {
            fastify: "^5.0.0",
            "socket.io": "^4.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "services", "api", "socket.ts"),
      "export const transport = 'socket.io';\n",
      "utf8"
    );
    await writeFile(
      path.join(cwd, ".github", "workflows", "release.yml"),
      "name: release\non: push\n",
      "utf8"
    );

    await runInit({
      cwd,
      projectPhase: "existing",
      frontend: "next",
      backend: "fastify",
      systemType: "realtime-app",
      architectureStyle: "event-driven",
      constraints: ["auth", "realtime"],
      projectContext: {
        currentPainPoints: ["realtime regressions"],
        stabilityConstraints: ["keep live channels stable"]
      }
    });

    await expect(
      readFile(
        path.join(cwd, "docs", "decisions", "ADR-0001-repository-baseline.md"),
        "utf8"
      )
    ).resolves.toContain("working baseline");
    await expect(
      readFile(path.join(cwd, "docs", "agents", "docs-contract.md"), "utf8")
    ).resolves.toContain(
      "This contract standardizes context routing, continuity, and verification expectations; it does not fix the final service architecture."
    );
    await expect(
      readFile(path.join(cwd, "docs", "product", "constraints.md"), "utf8")
    ).resolves.toContain("high-signal starting inputs");
    await expect(
      readFile(path.join(cwd, "docs", "operations", "runbooks.md"), "utf8")
    ).resolves.toContain("Realtime incidents");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "command-registry.md"), "utf8")
    ).resolves.toContain("cd services/api && npm test");
    await expect(
      readFile(path.join(cwd, "docs", "engineering", "command-registry.md"), "utf8")
    ).resolves.toContain("cd apps/web && npm run build");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "areas", "apps--web.md"), "utf8")
    ).resolves.toContain("Subtree script build -> next build.");
    await expect(
      readFile(path.join(cwd, "docs", "agents", "repo-facts.md"), "utf8")
    ).resolves.not.toContain(cwd);
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain(
      "\"activeWorkItem\": \"docs/work/active/0001-repository-baseline-and-target.md\""
    );
  });

  it("fails when a selected profile is unknown", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-"));

    await expect(
      runInit({ cwd, frontend: "unknown-frontend", backend: "nest" })
    ).rejects.toThrow("Unknown frontend profile: unknown-frontend");
  });
});

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile, readdir, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCreate } from "../../src/commands/create.js";
import { runInit } from "../../src/commands/init.js";
import { runSync } from "../../src/commands/sync.js";
import { runFoundationInit } from "../../src/lib/foundation-engine.js";

async function listFiles(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        return listFiles(root, absolutePath);
      }

      return [path.relative(root, absolutePath)];
    })
  );

  return files.flat().sort();
}

async function assertSameTree(leftRoot: string, rightRoot: string): Promise<void> {
  const leftFiles = await listFiles(leftRoot);
  const rightFiles = await listFiles(rightRoot);

  expect(leftFiles).toEqual(rightFiles);

  for (const relativePath of leftFiles) {
    const left = (await readFile(path.join(leftRoot, relativePath), "utf8")).replaceAll(
      leftRoot,
      "<ROOT>"
    );
    const right = (await readFile(path.join(rightRoot, relativePath), "utf8")).replaceAll(
      rightRoot,
      "<ROOT>"
    );
    expect(left).toBe(right);
  }
}

async function seedExistingApiRepo(cwd: string): Promise<void> {
  await mkdir(path.join(cwd, "src", "routes"), { recursive: true });
  await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
  await writeFile(path.join(cwd, "README.md"), "# Existing API\n\nKeep this README.\n", "utf8");
  await writeFile(
    path.join(cwd, "package.json"),
    JSON.stringify(
      {
        name: "existing-api",
        version: "1.0.0",
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
  await writeFile(
    path.join(cwd, ".github", "workflows", "release.yml"),
    "name: release\non: push\n",
    "utf8"
  );
}

describe("canonical foundation parity", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches canonical deferred init output", async () => {
    const cliDir = await mkdtemp(path.join(tmpdir(), "foundation-cli-parity-deferred-"));
    const foundationDir = await mkdtemp(path.join(tmpdir(), "foundation-engine-parity-deferred-"));

    await runInit({ cwd: cliDir, mode: "deferred" });
    await runFoundationInit({ cwd: foundationDir, mode: "deferred" });

    await assertSameTree(cliDir, foundationDir);
  });

  it("matches canonical output for a greenfield next+nested repository", async () => {
    const cliDir = await mkdtemp(path.join(tmpdir(), "foundation-cli-parity-greenfield-"));
    const foundationDir = await mkdtemp(
      path.join(tmpdir(), "foundation-engine-parity-greenfield-")
    );
    const selection = {
      projectPhase: "greenfield" as const,
      frontend: "next",
      backend: "nest",
      systemType: "internal-tool",
      architectureStyle: "modular-monolith",
      constraints: ["auth"],
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["strict-verification"],
      primaryProduct: "Internal operations portal",
      targetUsers: ["ops team"],
      coreEntities: ["ticket", "workspace"],
      criticalRisks: ["permission drift"],
      deliveryPriorities: ["safety", "speed"],
      currentPainPoints: [],
      stabilityConstraints: []
    };

    await runCreate({
      cwd: cliDir,
      answerSet: selection
    });
    await runFoundationInit({
      cwd: foundationDir,
      mode: "interactive",
      projectPhase: selection.projectPhase,
      frontend: selection.frontend,
      backend: selection.backend,
      systemType: selection.systemType,
      architectureStyle: selection.architectureStyle,
      constraints: selection.constraints,
      qualityProfiles: selection.qualityProfiles,
      practiceProfiles: selection.practiceProfiles,
      projectContext: {
        primaryProduct: selection.primaryProduct,
        targetUsers: selection.targetUsers,
        coreEntities: selection.coreEntities,
        criticalRisks: selection.criticalRisks,
        deliveryPriorities: selection.deliveryPriorities,
        currentPainPoints: selection.currentPainPoints,
        stabilityConstraints: selection.stabilityConstraints
      }
    });

    await assertSameTree(cliDir, foundationDir);
  });

  it("matches canonical output for existing repos with frontend:none and backend:fastify", async () => {
    const cliDir = await mkdtemp(path.join(tmpdir(), "foundation-cli-parity-existing-"));
    const foundationDir = await mkdtemp(path.join(tmpdir(), "foundation-engine-parity-existing-"));
    const selection = {
      projectPhase: "existing" as const,
      frontend: "none",
      backend: "fastify",
      systemType: "api-platform",
      architectureStyle: "service-oriented",
      constraints: ["auth"],
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["strict-verification"],
      primaryProduct: "Integration API",
      targetUsers: ["partner engineers", "internal ops"],
      coreEntities: ["account", "token", "webhook"],
      criticalRisks: ["breaking contracts"],
      deliveryPriorities: ["backward compatibility"],
      currentPainPoints: ["fragile contracts"],
      stabilityConstraints: ["keep existing API routes stable"]
    };

    await seedExistingApiRepo(cliDir);
    await seedExistingApiRepo(foundationDir);

    await runCreate({
      cwd: cliDir,
      answerSet: selection
    });
    await runFoundationInit({
      cwd: foundationDir,
      mode: "interactive",
      projectPhase: selection.projectPhase,
      frontend: selection.frontend,
      backend: selection.backend,
      systemType: selection.systemType,
      architectureStyle: selection.architectureStyle,
      constraints: selection.constraints,
      qualityProfiles: selection.qualityProfiles,
      practiceProfiles: selection.practiceProfiles,
      projectContext: {
        primaryProduct: selection.primaryProduct,
        targetUsers: selection.targetUsers,
        coreEntities: selection.coreEntities,
        criticalRisks: selection.criticalRisks,
        deliveryPriorities: selection.deliveryPriorities,
        currentPainPoints: selection.currentPainPoints,
        stabilityConstraints: selection.stabilityConstraints
      }
    });

    await assertSameTree(cliDir, foundationDir);
    await expect(readFile(path.join(cliDir, "README.md"), "utf8")).resolves.toBe(
      "# Existing API\n\nKeep this README.\n"
    );
  });

  it("matches canonical output for content sites with backend:none", async () => {
    const cliDir = await mkdtemp(path.join(tmpdir(), "foundation-cli-parity-content-"));
    const foundationDir = await mkdtemp(path.join(tmpdir(), "foundation-engine-parity-content-"));
    const selection = {
      projectPhase: "greenfield" as const,
      frontend: "next",
      backend: "none",
      systemType: "content-site",
      architectureStyle: "monolith",
      constraints: ["seo"],
      qualityProfiles: ["ci-basic"],
      practiceProfiles: ["ddd-core"],
      primaryProduct: "Editorial content platform",
      targetUsers: ["readers", "editors"],
      coreEntities: ["article", "author", "topic"],
      criticalRisks: ["slow publishing flow"],
      deliveryPriorities: ["preview reliability", "search visibility"],
      currentPainPoints: [],
      stabilityConstraints: []
    };

    await runCreate({
      cwd: cliDir,
      answerSet: selection
    });
    await runFoundationInit({
      cwd: foundationDir,
      mode: "interactive",
      projectPhase: selection.projectPhase,
      frontend: selection.frontend,
      backend: selection.backend,
      systemType: selection.systemType,
      architectureStyle: selection.architectureStyle,
      constraints: selection.constraints,
      qualityProfiles: selection.qualityProfiles,
      practiceProfiles: selection.practiceProfiles,
      projectContext: {
        primaryProduct: selection.primaryProduct,
        targetUsers: selection.targetUsers,
        coreEntities: selection.coreEntities,
        criticalRisks: selection.criticalRisks,
        deliveryPriorities: selection.deliveryPriorities,
        currentPainPoints: selection.currentPainPoints,
        stabilityConstraints: selection.stabilityConstraints
      }
    });

    await assertSameTree(cliDir, foundationDir);
  });

  it("migrates legacy CLI manifests on sync", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-legacy-sync-"));

    await mkdir(path.join(cwd, ".agent-foundation"), { recursive: true });
    await writeFile(
      path.join(cwd, ".agent-foundation", "manifest.json"),
      `${JSON.stringify(
        {
          version: "0.1.0",
          status: "resolved",
          frontend: "none",
          backend: "fastify",
          systemType: "api-platform",
          architectureStyle: "service-oriented",
          constraints: ["auth"],
          qualityProfiles: [],
          lastResolvedAt: "2026-03-16T12:00:00.000Z"
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    const result = await runSync({ cwd });
    const manifest = JSON.parse(
      await readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ) as {
      foundationVersion?: string;
      projectPhase?: string;
      installedProfiles?: string[];
    };

    expect(result.migratedLegacy).toBe(true);
    expect(manifest.foundationVersion).toBe("0.1.0");
    expect(manifest.projectPhase).toBe("greenfield");
    expect(manifest.installedProfiles).toContain("backend:fastify");
    await access(path.join(cwd, "CLAUDE.md"));
  });

  it("does not leave partial files behind when canonical validation fails", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-validation-"));

    await expect(
      runInit({
        cwd,
        mode: "interactive",
        selection: {
          projectPhase: "greenfield",
          frontend: "next",
          backend: "unknown-backend",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: [],
          qualityProfiles: [],
          practiceProfiles: [],
          primaryProduct: "",
          targetUsers: [],
          coreEntities: [],
          criticalRisks: [],
          deliveryPriorities: [],
          currentPainPoints: [],
          stabilityConstraints: []
        }
      })
    ).rejects.toThrow(/Unknown backend profile/);

    await expect(access(path.join(cwd, ".agent-foundation", "manifest.json"))).rejects.toThrow();
    await expect(access(path.join(cwd, "AGENTS.md"))).rejects.toThrow();
  });
});

import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execa } from "execa";
import { describe, expect, it } from "vitest";

describe("cli commands", () => {
  it("runs init interactively by default and prints repository health", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-default-init-"));

    const result = await execa("node", ["dist/cli.js", "init", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false,
      env: {
        ...process.env,
        AGENT_FOUNDATION_ANSWER_SET: JSON.stringify({
          projectPhase: "greenfield",
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: ["auth"],
          qualityProfiles: ["ci-basic"],
          currentPainPoints: [],
          stabilityConstraints: []
        })
      }
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("initialized");
    expect(result.stdout).toContain("foundation repository is healthy");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
  });

  it("runs init in deferred mode", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-init-"));

    const result = await execa(
      "node",
      ["dist/cli.js", "init", "--mode", "deferred", "--cwd", cwd],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("initialized");
    expect(result.stdout).toContain("foundation repository is healthy");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"unresolved\"");
  });

  it("passes direct project context flags into the canonical manifest", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-project-context-"));

    const result = await execa(
      "node",
      [
        "dist/cli.js",
        "init",
        "--cwd",
        cwd,
        "--project-phase",
        "greenfield",
        "--frontend",
        "next",
        "--backend",
        "nest",
        "--system-type",
        "internal-tool",
        "--architecture-style",
        "modular-monolith",
        "--constraint",
        "auth",
        "--quality-profile",
        "ci-basic",
        "--practice-profile",
        "strict-verification",
        "--primary-product",
        "ops cockpit",
        "--target-user",
        "support leads",
        "--core-entity",
        "workspace",
        "--critical-risk",
        "permission drift",
        "--delivery-priority",
        "safe rollout",
        "--current-pain-point",
        "fragile approvals",
        "--stability-constraint",
        "legacy consumers"
      ],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(result.exitCode).toBe(0);
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"primaryProduct\": \"ops cockpit\"");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"targetUsers\": [\n      \"support leads\"\n    ]");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"currentPainPoints\": [\n      \"fragile approvals\"\n    ]");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"stabilityConstraints\": [\n      \"legacy consumers\"\n    ]");
  });

  it("runs sync and restores managed files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-sync-"));

    await execa("node", ["dist/cli.js", "init", "--mode", "deferred", "--cwd", cwd], {
      cwd: process.cwd()
    });
    const agentsPath = path.join(cwd, "AGENTS.md");
    const existing = await readFile(agentsPath, "utf8");
    await writeFile(
      agentsPath,
      existing.replace("Stay in design mode until the design pack is coherent.", "BROKEN"),
      "utf8"
    );

    const result = await execa("node", ["dist/cli.js", "sync", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("updated:");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("docs/index.md");
  });

  it("runs doctor and reports a healthy repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-doctor-"));

    await execa(
      "node",
      [
        "dist/cli.js",
        "init",
        "--cwd",
        cwd,
        "--frontend",
        "next",
        "--backend",
        "nest",
        "--quality-profile",
        "ci-basic"
      ],
      {
        cwd: process.cwd()
      }
    );

    const result = await execa("node", ["dist/cli.js", "doctor", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("healthy");
  });

  it("supports direct status, history, and work commands", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-workflow-"));

    await execa(
      "node",
      [
        "dist/cli.js",
        "init",
        "--cwd",
        cwd,
        "--frontend",
        "next",
        "--backend",
        "nest",
        "--system-type",
        "internal-tool",
        "--architecture-style",
        "modular-monolith"
      ],
      {
        cwd: process.cwd()
      }
    );

    const status = await execa("node", ["dist/cli.js", "status", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("workflowMode: design");
    expect(status.stdout).toContain(
      "activeWorkItem: docs/work/active/0001-initial-design-scope.md"
    );

    const initialHistory = await execa("node", ["dist/cli.js", "history", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(initialHistory.exitCode).toBe(0);
    expect(initialHistory.stdout).toContain("archivedCount: 0");
    expect(initialHistory.stdout).toContain(
      "current: Active Work Item: Initial Design Scope | docs/work/active/0001-initial-design-scope.md"
    );

    const work = await execa(
      "node",
      [
        "dist/cli.js",
        "work",
        "--cwd",
        cwd,
        "--mode",
        "implementation",
        "--active-work-item",
        "0002-auth-boundary"
      ],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(work.exitCode).toBe(0);
    expect(work.stdout).toContain("workflowMode: implementation");
    expect(work.stdout).toContain("activeWorkItem: docs/work/active/0002-auth-boundary.md");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"mode\": \"implementation\"");

    const archive = await execa(
      "node",
      [
        "dist/cli.js",
        "work",
        "--cwd",
        cwd,
        "--archive-active",
        "--active-work-item",
        "0003-auth-rollout"
      ],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(archive.exitCode).toBe(0);
    expect(archive.stdout).toContain("archived: docs/work/archive/0002-auth-boundary.md");
    expect(archive.stdout).toContain("activeWorkItem: docs/work/active/0003-auth-rollout.md");

    const history = await execa("node", ["dist/cli.js", "history", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(history.exitCode).toBe(0);
    expect(history.stdout).toContain("archivedCount: 1");
    expect(history.stdout).toContain(
      "current: Active Work Item: Auth Rollout | docs/work/active/0003-auth-rollout.md"
    );
    expect(history.stdout).toContain(
      "archived: Active Work Item: Auth Boundary | docs/work/archive/0002-auth-boundary.md"
    );
    expect(history.stdout).toContain("summary: Archived automatically");
  });

  it("prints doctor warnings without failing the command", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-doctor-warning-"));

    await execa(
      "node",
      ["dist/cli.js", "init", "--cwd", cwd, "--frontend", "next", "--backend", "nest"],
      {
        cwd: process.cwd()
      }
    );
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      foundationVersion: string;
      status: string;
      projectPhase: string;
      frontend: string | null;
      backend: string | null;
      systemType: string | null;
      architectureStyle: string | null;
      constraints: string[];
      qualityProfiles: string[];
      practiceProfiles: string[];
      projectContext: {
        primaryProduct: string;
        targetUsers: string[];
        coreEntities: string[];
        criticalRisks: string[];
        deliveryPriorities: string[];
        currentPainPoints: string[];
        stabilityConstraints: string[];
      };
      installedProfiles: string[];
      lastResolvedAt: string | null;
    };
    manifest.status = "unresolved";
    manifest.frontend = null;
    manifest.backend = null;
    manifest.systemType = null;
    manifest.architectureStyle = null;
    manifest.constraints = [];
    manifest.qualityProfiles = [];
    manifest.practiceProfiles = [];
    manifest.projectContext = {
      primaryProduct: "",
      targetUsers: [],
      coreEntities: [],
      criticalRisks: [],
      deliveryPriorities: [],
      currentPainPoints: [],
      stabilityConstraints: []
    };
    manifest.installedProfiles = ["base", "phase:greenfield"];
    manifest.lastResolvedAt = null;
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await execa("node", ["dist/cli.js", "doctor", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Managed file drift detected: .agent-foundation/context-budget.json");
    expect(result.stderr).toContain("Warning: Unexpected merge-managed overlay file present");
  });

  it("supports sync dry-run", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-dry-run-"));

    await execa("node", ["dist/cli.js", "init", "--mode", "deferred", "--cwd", cwd], {
      cwd: process.cwd()
    });
    const agentsPath = path.join(cwd, "AGENTS.md");
    const existing = await readFile(agentsPath, "utf8");
    await writeFile(
      agentsPath,
      existing.replace("Stay in design mode until the design pack is coherent.", "BROKEN"),
      "utf8"
    );

    const result = await execa("node", ["dist/cli.js", "sync", "--dry-run", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("updated:");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("BROKEN");
  });

  it("supports sync repair", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-repair-"));

    await execa("node", ["dist/cli.js", "init", "--mode", "deferred", "--cwd", cwd], {
      cwd: process.cwd()
    });
    const agentsPath = path.join(cwd, "AGENTS.md");
    await writeFile(agentsPath, "broken\n", "utf8");

    const result = await execa(
      "node",
      ["dist/cli.js", "sync", "--repair", "--cwd", cwd],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("updated:");
    await expect(readFile(agentsPath, "utf8")).resolves.toContain("docs/index.md");
  });

  it("supports sync prune", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-prune-"));

    await execa(
      "node",
      [
        "dist/cli.js",
        "init",
        "--cwd",
        cwd,
        "--frontend",
        "next",
        "--backend",
        "nest",
        "--quality-profile",
        "ci-basic"
      ],
      {
        cwd: process.cwd()
      }
    );
    const manifestPath = path.join(cwd, ".agent-foundation", "manifest.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
      version: string;
      foundationVersion: string;
      status: string;
      projectPhase: string;
      frontend: string | null;
      backend: string | null;
      systemType: string | null;
      architectureStyle: string | null;
      constraints: string[];
      qualityProfiles: string[];
      practiceProfiles: string[];
      installedProfiles: string[];
      lastResolvedAt: string | null;
    };
    manifest.qualityProfiles = [];
    manifest.installedProfiles = [
      "base",
      "phase:greenfield",
      "frontend:next",
      "backend:nest",
      "system:internal-tool",
      "architecture:monolith"
    ];
    await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    const result = await execa(
      "node",
      ["dist/cli.js", "sync", "--prune", "--cwd", cwd],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("pruned: .github/workflows/ci.yml");
    await expect(
      readFile(path.join(cwd, ".github", "workflows", "ci.yml"), "utf8")
    ).rejects.toThrow();
  });

  it("runs interactive init from an answer set", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-interactive-"));

    const result = await execa(
      "node",
      ["dist/cli.js", "init", "--mode", "interactive", "--cwd", cwd],
      {
        cwd: process.cwd(),
        reject: false,
        env: {
          ...process.env,
          AGENT_FOUNDATION_ANSWER_SET: JSON.stringify({
            projectPhase: "greenfield",
            frontend: "next",
            backend: "nest",
            systemType: "internal-tool",
            architectureStyle: "modular-monolith",
            constraints: ["auth"],
            qualityProfiles: ["ci-basic"],
            currentPainPoints: [],
            stabilityConstraints: []
          })
        }
      }
    );

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("foundation repository is healthy");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"resolved\"");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("next");
  });

  it("fails init when a managed target already exists on first install", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-cli-collision-"));

    await mkdir(path.join(cwd, "docs", "architecture"), { recursive: true });
    await writeFile(path.join(cwd, "docs", "architecture", "overview.md"), "custom\n", "utf8");

    const result = await execa(
      "node",
      ["dist/cli.js", "init", "--mode", "deferred", "--cwd", cwd],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain("Existing files would be overwritten");
  });
});

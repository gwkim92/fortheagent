import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

describe("direct subcommands", () => {
  it("supports direct deferred init", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-direct-init-"));
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    const result = await execa("node", [cliPath, "init", "--mode", "deferred", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("initialized");
    expect(result.stdout).toContain("foundation repository is healthy");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "manifest.json"), "utf8")
    ).resolves.toContain("\"status\": \"unresolved\"");
  });

  it("supports direct init, status, history, work, and doctor subcommands", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-direct-resolved-"));
    const cliPath = path.join(process.cwd(), "dist", "cli.js");

    const init = await execa(
      "node",
      [
        cliPath,
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
        "Ops portal",
        "--target-user",
        "ops"
      ],
      {
        cwd: process.cwd(),
        reject: false
      }
    );

    expect(init.exitCode).toBe(0);
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("next");
    await expect(
      readFile(path.join(cwd, ".agent-foundation", "handoffs", "current.md"), "utf8")
    ).resolves.toContain("Current Handoff");

    const status = await execa("node", [cliPath, "status", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(status.exitCode).toBe(0);
    expect(status.stdout).toContain("status: resolved");
    expect(status.stdout).toContain("frontend: next");
    expect(status.stdout).toContain("backend: nest");
    expect(status.stdout).toContain("workflowMode: design");

    const initialHistory = await execa("node", [cliPath, "history", "--cwd", cwd], {
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
        cliPath,
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

    const archive = await execa(
      "node",
      [
        cliPath,
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

    const history = await execa("node", [cliPath, "history", "--cwd", cwd], {
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

    const doctor = await execa("node", [cliPath, "doctor", "--cwd", cwd], {
      cwd: process.cwd(),
      reject: false
    });

    expect(doctor.exitCode).toBe(0);
    expect(doctor.stdout).toContain("foundation repository is healthy");
  }, 10000);
});

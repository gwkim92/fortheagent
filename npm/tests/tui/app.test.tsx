import React from "react";
import { render } from "ink-testing-library";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PromptOptionSet } from "../../src/lib/init-session.js";
import type { RepositoryScan } from "../../src/lib/repo-scan.js";
import { InitTuiApp } from "../../src/tui/app.js";

const promptOptions: PromptOptionSet = {
  projectPhase: ["greenfield", "existing"],
  frontend: ["next", "react-spa", "none"],
  backend: ["nest", "fastify", "none"],
  systemType: ["internal-tool", "api-platform"],
  architectureStyle: ["monolith", "service-oriented"],
  constraints: ["auth", "payments"],
  qualityProfiles: ["ci-basic"],
  practiceProfiles: ["ddd-core", "tdd-first", "strict-verification"]
};

const baseScan: RepositoryScan = {
  root: "/tmp/demo",
  packageManager: "npm",
  installCommand: "npm install",
  workspaceLayout: "single-package",
  packageName: "demo",
  scripts: {},
  existingDocs: [],
  hasCi: false,
  ciFiles: [],
  frontendHints: [],
  backendHints: [],
  routeHints: [],
  apiHints: [],
  dataHints: [],
  realtimeToolHints: [],
  dataToolHints: [],
  testHints: [],
  systemTypeHints: [],
  architectureStyleHints: [],
  phaseRecommendation: "existing",
  phaseRecommendationReasons: ["source structure or stack hints already exist"],
  importantFiles: [],
  availableSkills: [],
  hasSkillInstaller: false
};

const waitForFrame = async () => {
  await new Promise((resolve) => setTimeout(resolve, 40));
};

const waitForFrameContaining = async (
  app: ReturnType<typeof render>,
  text: string,
  attempts = 6
) => {
  for (let index = 0; index < attempts; index += 1) {
    await waitForFrame();

    if (app.lastFrame().includes(text)) {
      return;
    }
  }
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InitTuiApp", () => {
  it("focuses the recommended project phase by default", async () => {
    const onExit = vi.fn();
    const app = render(
      <InitTuiApp
        cwd="/tmp/demo"
        scan={baseScan}
        promptOptions={promptOptions}
        defaults={{ projectPhase: "existing" }}
        initialScreen="phase"
        onExit={onExit}
      />
    );

    await waitForFrame();

    expect(app.lastFrame()).toContain("› ◆ Existing Repository");
    app.unmount();
  });

  it("toggles multi-select requirements with space", async () => {
    const onExit = vi.fn();
    const app = render(
      <InitTuiApp
        cwd="/tmp/demo"
        scan={{ ...baseScan, phaseRecommendation: "greenfield", phaseRecommendationReasons: ["very little existing project structure was detected"] }}
        promptOptions={promptOptions}
        defaults={{ projectPhase: "greenfield" }}
        initialScreen="requirements"
        onExit={onExit}
      />
    );

    await waitForFrame();
    app.stdin.write(" ");
    await waitForFrame();

    expect(app.lastFrame()).toContain("› [■] Authentication and Access");
    expect(app.lastFrame()).toContain("Control");
    app.unmount();
  });

  it("shows generated file preview on the review screen", async () => {
    const onExit = vi.fn();
    const app = render(
      <InitTuiApp
        cwd="/tmp/demo"
        scan={baseScan}
        promptOptions={promptOptions}
        defaults={{
          projectPhase: "greenfield",
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "monolith"
        }}
        initialScreen="review"
        onExit={onExit}
      />
    );

    await waitForFrameContaining(app, "docs/architecture/frontend.md");

    expect(app.lastFrame()).toContain("docs/architecture/frontend.md");
    app.unmount();
  });

  it("runs init and doctor from the submit flow and shows success", async () => {
    const onExit = vi.fn();
    const runInitAction = vi.fn(async () => ({ manifest: null, updated: ["AGENTS.md", "CLAUDE.md"] }));
    const runDoctorAction = vi.fn(async () => ({
      ok: true,
      errors: [],
      warnings: [],
      repairCommands: []
    }));
    const app = render(
      <InitTuiApp
        cwd="/tmp/demo"
        scan={baseScan}
        promptOptions={promptOptions}
        defaults={{
          projectPhase: "greenfield",
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "monolith"
        }}
        initialScreen="review"
        runInitAction={runInitAction as never}
        runDoctorAction={runDoctorAction as never}
        onExit={onExit}
      />
    );

    await waitForFrame();
    app.stdin.write("\r");
    await waitForFrame();
    await waitForFrame();

    expect(runInitAction).toHaveBeenCalled();
    expect(runDoctorAction).toHaveBeenCalled();
    expect(app.lastFrame()).toContain("foundation repository is");
    expect(app.lastFrame()).toContain("healthy");
    app.unmount();
  });
});

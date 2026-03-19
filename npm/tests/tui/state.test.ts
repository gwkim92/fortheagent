import { describe, expect, it } from "vitest";
import { createInitialTuiState, tuiReducer } from "../../src/tui/state.js";
import type { PromptOptionSet } from "../../src/lib/init-session.js";
import type { RepositoryScan } from "../../src/lib/repo-scan.js";
import type { SelectionInput } from "../../src/lib/selection.js";

const promptOptions: PromptOptionSet = {
  projectPhase: ["greenfield", "existing"],
  frontend: ["next", "none"],
  backend: ["nest", "none"],
  systemType: ["internal-tool", "api-platform"],
  architectureStyle: ["monolith", "service-oriented"],
  constraints: ["auth", "payments"],
  qualityProfiles: ["ci-basic"],
  practiceProfiles: ["ddd-core", "tdd-first", "strict-verification"]
};

const scan: RepositoryScan = {
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
  phaseRecommendation: "greenfield",
  phaseRecommendationReasons: ["very little existing project structure was detected"],
  importantFiles: [],
  availableSkills: [],
  hasSkillInstaller: false
};

const selection: SelectionInput = {
  projectPhase: "greenfield",
  frontend: "next",
  backend: "nest",
  systemType: "internal-tool",
  architectureStyle: "monolith",
  constraints: [],
  qualityProfiles: [],
  practiceProfiles: ["ddd-core"],
  primaryProduct: "",
  targetUsers: [],
  coreEntities: [],
  criticalRisks: [],
  deliveryPriorities: [],
  currentPainPoints: [],
  stabilityConstraints: []
};

describe("tui state", () => {
  it("builds initial state with scan/defaults/prompt options", () => {
    const state = createInitialTuiState({
      scan,
      defaults: { projectPhase: "greenfield" },
      promptOptions,
      selection
    });

    expect(state.currentScreen).toBe("scan");
    expect(state.scan.phaseRecommendation).toBe("greenfield");
    expect(state.selection.frontend).toBe("next");
  });

  it("merges selection changes and stores preview files", () => {
    const state = createInitialTuiState({
      scan,
      defaults: {},
      promptOptions,
      selection
    });
    const nextState = tuiReducer(
      tuiReducer(state, {
        type: "merge-selection",
        selection: { projectPhase: "existing", currentPainPoints: ["fragile contracts"] }
      }),
      {
        type: "set-preview-files",
        files: ["AGENTS.md", "docs/architecture/current-state.md"]
      }
    );

    expect(nextState.selection.projectPhase).toBe("existing");
    expect(nextState.selection.currentPainPoints).toEqual(["fragile contracts"]);
    expect(nextState.previewFiles).toContain("docs/architecture/current-state.md");
  });
});

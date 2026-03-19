import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { buildQuestions } from "../../src/lib/questions.js";
import { previewDiscover, runDiscover } from "../../src/commands/discover.js";

describe("buildQuestions", () => {
  it("returns the fixed discovery question set", () => {
    const questions = buildQuestions();

    expect(questions.map((question) => question.name)).toEqual([
      "projectPhase",
      "frontend",
      "backend",
      "systemType",
      "architectureStyle",
      "constraints",
      "qualityProfiles",
      "practiceProfiles",
      "primaryProduct",
      "targetUsers",
      "coreEntities",
      "criticalRisks",
      "deliveryPriorities",
      "currentPainPoints",
      "stabilityConstraints"
    ]);
  });

  it("makes the discovery preview return the shared question set", () => {
    expect(previewDiscover().questions).toEqual(buildQuestions());
  });

  it("rewrites the repository selection through the discovery flow", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-discover-"));

    const result = await runDiscover({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    expect(result.manifest.status).toBe("resolved");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("next");
  });

  it("reuses the existing manifest as defaults when partial answers are provided", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-discover-defaults-"));

    await runDiscover({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    const result = await runDiscover({
      cwd,
      answerSet: {
        backend: "fastify"
      }
    });

    expect(result.manifest.frontend).toBe("next");
    expect(result.manifest.backend).toBe("fastify");
    expect(result.manifest.constraints).toEqual(["auth"]);
  });
});

import { describe, expect, it } from "vitest";
import {
  buildContextBudgetManifest,
  classifyContextFile,
  getContextBudget
} from "../../src/lib/context-budget.js";

describe("context budget", () => {
  it("classifies root entry files as bootstrap context", () => {
    expect(classifyContextFile("AGENTS.md")).toBe("bootstrap");
    expect(classifyContextFile("CLAUDE.md")).toBe("bootstrap");
    expect(classifyContextFile("GEMINI.md")).toBe("bootstrap");
  });

  it("classifies skills and scoped docs into the expected classes", () => {
    expect(classifyContextFile("docs/skills/index.md")).toBe("skill-metadata");
    expect(classifyContextFile(".agents/skills/docs-writer/SKILL.md")).toBe("skill-body");
    expect(classifyContextFile("docs/architecture/frontend.md")).toBe("scoped");
  });

  it("assigns line budgets to key startup files", () => {
    expect(getContextBudget("AGENTS.md")).toBe(120);
    expect(getContextBudget("docs/index.md")).toBe(120);
    expect(getContextBudget(".agents/skills/docs-writer/SKILL.md")).toBe(150);
  });

  it("builds a manifest entry for each generated file", () => {
    const manifest = buildContextBudgetManifest([
      "AGENTS.md",
      "CLAUDE.md",
      "GEMINI.md",
      "docs/index.md",
      ".agents/skills/docs-writer/SKILL.md"
    ]);

    expect(manifest.entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          filePath: "AGENTS.md",
          contextClass: "bootstrap",
          maxLines: 120
        }),
        expect.objectContaining({
          filePath: ".agents/skills/docs-writer/SKILL.md",
          contextClass: "skill-body",
          maxLines: 150
        })
      ])
    );
  });
});

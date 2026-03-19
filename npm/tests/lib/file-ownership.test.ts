import { describe, expect, it } from "vitest";
import { classifyFile } from "../../src/lib/file-ownership.js";

describe("classifyFile", () => {
  it("marks foundation files with the expected ownership", () => {
    expect(classifyFile(".agent-foundation/manifest.json")).toBe("managed");
    expect(classifyFile(".agent-foundation/profile-registry.json")).toBe("managed");
    expect(classifyFile(".agent-foundation/context-budget.json")).toBe("managed");
    expect(classifyFile(".agent-foundation/provider-projections.json")).toBe("managed");
    expect(classifyFile(".agent-foundation/handoff/design-ready.md")).toBe("managed");
    expect(classifyFile(".agents/skills/docs-writer/SKILL.md")).toBe("managed");
    expect(classifyFile(".claude/rules/index.md")).toBe("managed");
    expect(classifyFile(".claude/rules/testing.md")).toBe("managed");
    expect(classifyFile(".cursor/rules/architecture.mdc")).toBe("managed");
    expect(classifyFile(".cursor/rules/testing.mdc")).toBe("managed");
    expect(classifyFile("docs/agents/repo-facts.md")).toBe("managed");
    expect(classifyFile("docs/index.md")).toBe("merge-managed");
    expect(classifyFile("docs/system/overview.md")).toBe("merge-managed");
    expect(classifyFile("docs/product/constraints/payments.md")).toBe("merge-managed");
    expect(classifyFile("docs/practices/ddd-core.md")).toBe("merge-managed");
    expect(classifyFile(".github/workflows/ci.yml")).toBe("managed");
    expect(classifyFile("AGENTS.md")).toBe("merge-managed");
    expect(classifyFile("CLAUDE.md")).toBe("merge-managed");
    expect(classifyFile("GEMINI.md")).toBe("merge-managed");
    expect(classifyFile("docs/project-notes.md")).toBe("user-owned");
  });
});

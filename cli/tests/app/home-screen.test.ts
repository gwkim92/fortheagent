import { describe, expect, it } from "vitest";
import { renderHomeScreen } from "../../src/app/home-screen.js";

describe("home screen", () => {
  it("renders the two launcher modes", () => {
    const screen = renderHomeScreen("/tmp/demo");

    expect(screen).toContain("forTheAgent");
    expect(screen).toContain("[1] Guided Setup");
    expect(screen).toContain("[2] Ask forTheAgent");
    expect(screen).toContain("Codex");
    expect(screen).toContain("Claude Code");
    expect(screen).toContain("Gemini CLI");
    expect(screen).toContain("⌁[◕▿◕]");
    expect(screen).toContain("docs companion");
    expect(screen).toContain("review auth flow");
    expect(screen).toContain("/tmp/demo");
  });
});

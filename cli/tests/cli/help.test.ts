import { describe, expect, it } from "vitest";
import { execa } from "execa";

describe("cli", () => {
  it("prints launcher help for fortheagent-cli", async () => {
    const result = await execa("node", ["dist/cli.js", "--help"], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.stdout).toContain("Usage: fortheagent-cli");
    expect(result.stdout).toContain("Guided Setup");
    expect(result.stdout).toContain("Ask forTheAgent");
    expect(result.stdout).toContain("fortheagent-cli init");
    expect(result.stdout).toContain("fortheagent-cli doctor");
    expect(result.stdout).toContain("fortheagent-cli status");
    expect(result.stdout).toContain("gd");
    expect(result.stdout).toContain("explain this repository");
    expect(result.stdout).toContain("architecture");
    expect(result.stdout).toContain("next steps");
    expect(result.stdout).toContain("review auth flow");
    expect(result.stdout).not.toContain("create      interactive bootstrap");
  });
});

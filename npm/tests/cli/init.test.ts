import { describe, expect, it } from "vitest";
import { execa } from "execa";
import { shouldUseTuiForInit } from "../../src/cli.js";

describe("cli", () => {
  it("chooses the TUI only for TTY interactive init without plain mode or answer sets", () => {
    expect(
      shouldUseTuiForInit(
        {
          mode: undefined,
          frontend: undefined,
          backend: undefined,
          plain: false,
          answerSet: undefined
        },
        {
          stdinIsTTY: true,
          stdoutIsTTY: true
        }
      )
    ).toBe(true);

    expect(
      shouldUseTuiForInit(
        {
          mode: undefined,
          frontend: undefined,
          backend: undefined,
          plain: true,
          answerSet: undefined
        },
        {
          stdinIsTTY: true,
          stdoutIsTTY: true
        }
      )
    ).toBe(false);
  });

  it("prints help when no command is provided", async () => {
    const result = await execa("node", ["dist/cli.js"], {
      cwd: process.cwd(),
      reject: false
    });

    expect(result.stdout).toContain("init");
    expect(result.stdout).toContain("sync");
    expect(result.stdout).toContain("doctor");
    expect(result.stdout).toContain("--plain");
  });
});

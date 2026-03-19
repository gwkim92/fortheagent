import { describe, expect, it } from "vitest";
import { PassThrough, Writable } from "node:stream";
import {
  promptForChecklistSelection,
  promptForMenuSelection
} from "../../src/lib/terminal.js";

describe("terminal menu selection", () => {
  it("supports arrow-key selection in raw tty mode", async () => {
    const input = new PassThrough() as PassThrough & {
      isTTY: boolean;
      setRawMode(enabled: boolean): void;
    };
    let stdout = "";
    const rawModeChanges: boolean[] = [];

    input.isTTY = true;
    input.setRawMode = (enabled: boolean) => {
      rawModeChanges.push(enabled);
    };

    const output = new Writable({
      write(chunk, _encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });

    const selectionPromise = promptForMenuSelection({
      title: "Select a mode",
      streams: { input, output },
      options: [
        { label: "[1] Guided Setup", value: "setup" },
        { label: "[2] Ask forTheAgent", value: "ask" },
        { label: "[3] Type work directly", value: "type" }
      ]
    });

    input.write("\u001b[B");
    input.write("\r");

    await expect(selectionPromise).resolves.toBe("ask");
    expect(rawModeChanges).toEqual([true, false]);
    expect(stdout).toContain("Select a mode");
    expect(stdout).toContain("Use ↑ ↓ to move and Enter to confirm.");
    expect(stdout).toContain("[2] Ask forTheAgent");
  });

  it("supports checklist toggles in raw tty mode", async () => {
    const input = new PassThrough() as PassThrough & {
      isTTY: boolean;
      setRawMode(enabled: boolean): void;
    };
    let stdout = "";

    input.isTTY = true;
    input.setRawMode = () => {};

    const output = new Writable({
      write(chunk, _encoding, callback) {
        stdout += chunk.toString();
        callback();
      }
    });

    const selectionPromise = promptForChecklistSelection({
      title: "Select constraints",
      streams: { input, output },
      options: [
        { label: "[1] seo", value: "seo" },
        { label: "[2] auth", value: "auth" },
        { label: "[3] payments", value: "payments" }
      ]
    });

    input.write(" ");
    input.write("\u001b[B");
    input.write(" ");
    input.write("\r");

    await expect(selectionPromise).resolves.toEqual(["seo", "auth"]);
    expect(stdout).toContain("Use ↑ ↓ to move, Space to toggle, Enter to confirm.");
    expect(stdout).toContain("[x]");
  });
});

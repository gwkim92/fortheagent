import { describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import { runCli } from "../../src/run-cli.js";
import { TerminalAbortError } from "../../src/lib/abort.js";

describe("launcher abort handling", () => {
  it("exits cleanly when the user presses Ctrl+C during interactive input", async () => {
    let output = "";

    const stdout = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      }
    });

    const exitCode = await runCli({
      argv: [],
      streams: {
        output: stdout
      },
      async runAppImpl() {
        throw new TerminalAbortError();
      }
    });

    expect(exitCode).toBe(130);
    expect(output).toContain("Cancelled.");
    expect(output).not.toContain("AbortError");
  });
});

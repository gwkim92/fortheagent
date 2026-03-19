import { afterEach, describe, expect, it } from "vitest";
import {
  configureOpenUrlForTests,
  openUrl,
  resetOpenUrlForTests,
  resolveOpenUrlCommand
} from "../../src/lib/open-url.js";

describe("open url", () => {
  afterEach(() => {
    resetOpenUrlForTests();
  });

  it("resolves platform-specific launch commands", () => {
    expect(resolveOpenUrlCommand("https://example.com", "darwin")).toEqual({
      file: "open",
      args: ["https://example.com"]
    });
    expect(resolveOpenUrlCommand("https://example.com", "win32")).toEqual({
      file: "cmd.exe",
      args: ["/c", "start", "", "https://example.com"]
    });
    expect(resolveOpenUrlCommand("https://example.com", "linux")).toEqual({
      file: "xdg-open",
      args: ["https://example.com"]
    });
  });

  it("delegates to the configured command runner", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    configureOpenUrlForTests({
      commandRunner: async (file, args) => {
        calls.push({ file, args });
      }
    });

    await openUrl("https://example.com");

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toContain("https://example.com");
  });
});

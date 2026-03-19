import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  configureSecretStoreForTests,
  deleteSecret,
  readSecret,
  resetSecretStoreForTests,
  writeSecret
} from "../../src/lib/secret-store.js";

describe("secret store", () => {
  let foundationHome: string;

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    delete process.env.FOUNDATION_SECRET_BACKEND;
    resetSecretStoreForTests();

    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
    }
  });

  it("uses the macOS keychain backend when configured", async () => {
    const calls: Array<{ file: string; args: string[] }> = [];
    foundationHome = await mkdtemp(path.join(tmpdir(), "foundation-cli-secret-store-"));
    process.env.FOUNDATION_HOME = foundationHome;
    process.env.FOUNDATION_SECRET_BACKEND = "keychain";

    let storedSecret = "";
    configureSecretStoreForTests({
      commandRunner: async (file, args) => {
        calls.push({ file, args });

        if (args[0] === "add-generic-password") {
          storedSecret = args[args.length - 1] ?? "";
          return { stdout: "", stderr: "" };
        }

        if (args[0] === "find-generic-password") {
          return { stdout: `${storedSecret}\n`, stderr: "" };
        }

        if (args[0] === "delete-generic-password") {
          storedSecret = "";
          return { stdout: "", stderr: "" };
        }

        throw new Error("unexpected keychain command");
      }
    });

    await writeSecret("openai-api", JSON.stringify({ kind: "api-key", apiKey: "secret" }));
    expect(await readSecret("openai-api")).toContain("\"apiKey\":\"secret\"");
    await deleteSecret("openai-api");

    expect(calls.map((call) => call.args[0])).toEqual([
      "add-generic-password",
      "find-generic-password",
      "delete-generic-password"
    ]);
  });

  it("falls back to the local credentials file when keychain access fails", async () => {
    foundationHome = await mkdtemp(path.join(tmpdir(), "foundation-cli-secret-store-"));
    process.env.FOUNDATION_HOME = foundationHome;

    configureSecretStoreForTests({
      backendMode: {
        backend: "keychain",
        allowFileFallback: true
      },
      commandRunner: async () => {
        throw new Error("keychain unavailable");
      }
    });

    await writeSecret("anthropic-api", JSON.stringify({ kind: "api-key", apiKey: "fallback" }));

    const stored = await readSecret("anthropic-api");
    const credentialsContents = await readFile(
      path.join(foundationHome, "credentials.json"),
      "utf8"
    );

    expect(stored).toContain("\"apiKey\":\"fallback\"");
    expect(credentialsContents).toContain("\"apiKey\": \"fallback\"");
  });
});

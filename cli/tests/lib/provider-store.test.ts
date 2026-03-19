import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  readProviderConfig,
  readProviderCredentials,
  setDefaultProvider,
  upsertProviderConfig,
  upsertProviderCredential
} from "../../src/lib/provider-store.js";

describe("provider store", () => {
  let foundationHome: string;

  afterEach(async () => {
    delete process.env.FOUNDATION_HOME;
    if (foundationHome) {
      await rm(foundationHome, { recursive: true, force: true });
    }
  });

  it("persists provider config and credentials outside the repository", async () => {
    foundationHome = await mkdtemp(path.join(tmpdir(), "foundation-cli-home-"));
    process.env.FOUNDATION_HOME = foundationHome;

    await upsertProviderConfig({
      id: "openai-api",
      kind: "api-key",
      model: "gpt-5",
      apiBaseUrl: "https://api.openai.com/v1"
    });
    await upsertProviderCredential("openai-api", {
      kind: "api-key",
      apiKey: "secret"
    });
    await setDefaultProvider("openai-api");

    const config = await readProviderConfig();
    const credentials = await readProviderCredentials();

    expect(config.defaultProvider).toBe("openai-api");
    expect(config.providers["openai-api"]).toMatchObject({
      model: "gpt-5"
    });
    expect(credentials.providers["openai-api"]).toMatchObject({
      apiKey: "secret"
    });

    const configContents = await readFile(path.join(foundationHome, "config.json"), "utf8");
    const credentialContents = await readFile(
      path.join(foundationHome, "credentials.json"),
      "utf8"
    );

    expect(configContents).toContain("\"defaultProvider\": \"openai-api\"");
    expect(credentialContents).toContain("\"apiKey\": \"secret\"");
  });
});

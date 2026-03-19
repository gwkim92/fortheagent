import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createSession } from "../../src/lib/prompt.js";
import { runCreate } from "../../src/commands/create.js";

describe("createSession", () => {
  it("returns answers keyed by discovery field", async () => {
    const session = createSession({
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    await expect(session.run()).resolves.toMatchObject({
      frontend: "next",
      backend: "nest"
    });
  });

  it("supports retrying until a confirmation is accepted", async () => {
    const session = createSession({
      answerSet: [
        {
          frontend: "react-spa",
          backend: "fastify",
          systemType: "content-site",
          architectureStyle: "monolith",
          constraints: [],
          confirm: false
        },
        {
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: ["auth"],
          confirm: true
        }
      ]
    });

    await expect(session.run()).resolves.toMatchObject({
      frontend: "next",
      backend: "nest",
      constraints: ["auth"]
    });
  });

  it("merges partial answers with existing defaults", async () => {
    const session = createSession({
      defaults: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      },
      answerSet: {
        backend: "fastify",
        confirm: true
      }
    });

    await expect(session.run()).resolves.toMatchObject({
      frontend: "next",
      backend: "fastify",
      constraints: ["auth"]
    });
  });

  it("creates a resolved repository skeleton from the answer set", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-create-"));

    const result = await runCreate({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "internal-tool",
        architectureStyle: "modular-monolith",
        constraints: ["auth"]
      }
    });

    expect(result.manifest.status).toBe("resolved");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "frontend.md"), "utf8")
    ).resolves.toContain("next");
    await expect(
      readFile(path.join(cwd, "docs", "architecture", "backend.md"), "utf8")
    ).resolves.toContain("nest");
  });
});

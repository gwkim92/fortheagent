import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { runCreate } from "../../src/commands/create.js";
import { runGenerateDocs } from "../../src/commands/generate-docs.js";

describe("generate docs command", () => {
  it("writes resolved project-specific docs from the manifest", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "fortheagent-generate-docs-"));

    await runCreate({
      cwd,
      answerSet: {
        frontend: "next",
        backend: "nest",
        systemType: "content-site",
        architectureStyle: "monolith",
        constraints: []
      }
    });

    const result = await runGenerateDocs({ cwd });
    const projectDiscovery = await readFile(path.join(cwd, "docs/agents/project-discovery.md"), "utf8");
    const architectureOverview = await readFile(path.join(cwd, "docs/architecture/overview.md"), "utf8");
    const systemOverview = await readFile(path.join(cwd, "docs/system/overview.md"), "utf8");

    expect(result.responseText).toContain("Generated project-specific docs");
    expect(projectDiscovery).toContain("Discovery is resolved for this repository.");
    expect(projectDiscovery).toContain("- frontend profile: `next`");
    expect(architectureOverview).toContain("resolved foundation bootstrap for a `content-site`");
    expect(systemOverview).toContain("monolithic `next` and `nest` application stack");
  });
});

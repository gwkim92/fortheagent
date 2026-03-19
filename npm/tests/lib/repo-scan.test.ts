import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scanRepository } from "../../src/lib/repo-scan.js";

describe("scanRepository", () => {
  it("recommends greenfield for an almost-empty repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-scan-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify({ name: "empty-demo" }, null, 2),
      "utf8"
    );

    const scan = await scanRepository(cwd);

    expect(scan.phaseRecommendation).toBe("greenfield");
    expect(scan.packageManager).toBe("npm");
    expect(scan.installCommand).toBe("npm install");
    expect(scan.phaseRecommendationReasons).toContain(
      "very little existing project structure was detected"
    );
  });

  it("detects representative product and stack hints from local files", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-scan-"));

    await mkdir(path.join(cwd, "src", "pages"), { recursive: true });
    await mkdir(path.join(cwd, "src", "api"), { recursive: true });
    await mkdir(path.join(cwd, "supabase"), { recursive: true });
    await mkdir(path.join(cwd, "tests"), { recursive: true });
    await mkdir(path.join(cwd, ".github", "workflows"), { recursive: true });
    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "scan-demo",
          packageManager: "pnpm@9.0.0",
          scripts: {
            lint: "eslint .",
            test: "vitest run",
            build: "vite build"
          },
          dependencies: {
            react: "^19.0.0",
            fastify: "^5.0.0",
            "drizzle-orm": "^0.0.0",
            "@supabase/supabase-js": "^2.0.0",
            "socket.io": "^4.0.0"
          },
          devDependencies: {
            vitest: "^3.0.0",
            "@playwright/test": "^1.0.0"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(path.join(cwd, "README.md"), "# Scan Demo\n", "utf8");
    await writeFile(path.join(cwd, ".github", "workflows", "existing.yml"), "name: existing\n", "utf8");
    await writeFile(path.join(cwd, "drizzle.config.ts"), "export default {};\n", "utf8");
    await writeFile(path.join(cwd, "playwright.config.ts"), "export default {};\n", "utf8");
    await writeFile(path.join(cwd, "openapi.yaml"), "openapi: 3.1.0\n", "utf8");
    await writeFile(path.join(cwd, "supabase", "config.toml"), "project_id = \"demo\"\n", "utf8");

    const scan = await scanRepository(cwd);

    expect(scan.packageManager).toBe("pnpm");
    expect(scan.installCommand).toBe("pnpm install");
    expect(scan.frontendHints).toContain("react-spa");
    expect(scan.backendHints).toContain("fastify");
    expect(scan.routeHints).toContain("src/pages/");
    expect(scan.apiHints).toContain("src/api/");
    expect(scan.apiHints).toContain("openapi.yaml");
    expect(scan.dataHints).toContain("Drizzle ORM");
    expect(scan.dataHints).toContain("Drizzle config");
    expect(scan.dataHints).toContain("Supabase");
    expect(scan.realtimeToolHints).toContain("socket.io");
    expect(scan.dataToolHints).toContain("drizzle");
    expect(scan.dataToolHints).toContain("supabase");
    expect(scan.testHints).toContain("Playwright");
    expect(scan.testHints).toContain("tests/");
    expect(scan.systemTypeHints).toContain("api-platform");
    expect(scan.systemTypeHints).toContain("realtime-app");
    expect(scan.architectureStyleHints).toContain("event-driven");
    expect(scan.phaseRecommendation).toBe("existing");
    expect(scan.phaseRecommendationReasons.length).toBeGreaterThan(0);
    expect(scan.hasCi).toBe(true);
    expect(scan.ciFiles).toContain(".github/workflows/existing.yml");
    expect(scan.importantFiles).toContain("README.md");
    expect(scan.importantFiles).toContain(".github/workflows/existing.yml");
    expect(scan.importantFiles).toContain("drizzle.config.ts");
    expect(scan.importantFiles).toContain("playwright.config.ts");
    expect(scan.importantFiles).toContain("openapi.yaml");
    expect(Array.isArray(scan.availableSkills)).toBe(true);
    expect(typeof scan.hasSkillInstaller).toBe("boolean");
  });

  it("recommends existing for monorepos with real subtree roots", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-scan-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "workspace-root",
          private: true,
          workspaces: ["apps/*", "services/*"]
        },
        null,
        2
      ),
      "utf8"
    );
    await mkdir(path.join(cwd, "apps", "web"), { recursive: true });
    await writeFile(path.join(cwd, "apps", "web", "package.json"), "{\"name\":\"web\"}\n", "utf8");
    await mkdir(path.join(cwd, "services", "api"), { recursive: true });
    await writeFile(path.join(cwd, "services", "api", "package.json"), "{\"name\":\"api\"}\n", "utf8");

    const scan = await scanRepository(cwd);

    expect(scan.workspaceLayout).toBe("monorepo");
    expect(scan.subtreeRoots).toContain("apps/web");
    expect(scan.subtreeRoots).toContain("services/api");
    expect(scan.phaseRecommendation).toBe("existing");
    expect(scan.phaseRecommendationReasons).toContain(
      "workspace packages or monorepo roots already exist"
    );
  });

  it("detects stack, route, api, and realtime hints from subtree packages", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "agent-foundation-scan-"));

    await writeFile(
      path.join(cwd, "package.json"),
      JSON.stringify(
        {
          name: "workspace-root",
          private: true,
          workspaces: {
            packages: ["apps/*", "services/*"]
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await mkdir(path.join(cwd, "apps", "web", "src", "app"), { recursive: true });
    await writeFile(
      path.join(cwd, "apps", "web", "package.json"),
      JSON.stringify(
        {
          name: "web",
          dependencies: {
            next: "^16.0.0",
            react: "^19.0.0"
          },
          scripts: {
            build: "next build"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await mkdir(path.join(cwd, "services", "api", "src", "routes"), { recursive: true });
    await mkdir(path.join(cwd, "services", "api", "tests"), { recursive: true });
    await writeFile(
      path.join(cwd, "services", "api", "package.json"),
      JSON.stringify(
        {
          name: "api",
          dependencies: {
            fastify: "^5.0.0"
          },
          scripts: {
            test: "vitest run"
          }
        },
        null,
        2
      ),
      "utf8"
    );
    await writeFile(
      path.join(cwd, "services", "api", "socket.ts"),
      "export const transport = 'socket.io';\n",
      "utf8"
    );

    const scan = await scanRepository(cwd);

    expect(scan.workspaceLayout).toBe("monorepo");
    expect(scan.frontendHints).toContain("next");
    expect(scan.backendHints).toContain("fastify");
    expect(scan.routeHints).toContain("apps/web/src/app/");
    expect(scan.apiHints).toContain("services/api/src/routes/");
    expect(scan.testHints).toContain("services/api/tests/");
    expect(scan.realtimeToolHints).toContain("socket.io");
    expect(scan.systemTypeHints).toContain("realtime-app");
    expect(scan.architectureStyleHints).toContain("event-driven");
    expect(scan.importantFiles).toContain("apps/web/package.json");
    expect(scan.importantFiles).toContain("services/api/package.json");
    expect(scan.importantFiles).toContain("services/api/socket.ts");
    expect(scan.subtrees).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          root: "apps/web",
          packageName: "web",
          scripts: {
            build: "next build"
          },
          routeHints: ["apps/web/src/app/"],
          testHints: expect.arrayContaining(["build script: next build"])
        }),
        expect.objectContaining({
          root: "services/api",
          packageName: "api",
          scripts: {
            test: "vitest run"
          },
          apiHints: ["services/api/src/routes/"],
          testHints: expect.arrayContaining(["test script: vitest run", "tests/"])
        })
      ])
    );
    expect(scan.phaseRecommendation).toBe("existing");
  });
});

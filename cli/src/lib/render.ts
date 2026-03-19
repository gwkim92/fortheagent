import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { profileRegistry } from "./profile-registry.js";
import { buildContextBudgetManifest } from "./context-budget.js";
import { buildProviderProjectionManifest } from "./provider-projections.js";
import { listTemplateFiles, resolveTemplateSourcePath, toRepositoryPath } from "./templates.js";
import type { Manifest } from "./manifest.js";
import type { SelectionInput } from "./selection.js";
import { resolveManifestPath, resolveProfileRegistryPath } from "./paths.js";

export type RenderSummary = {
  created: string[];
  updated: string[];
  unchanged: string[];
};

async function writeFileIfChanged(
  targetPath: string,
  content: string
): Promise<"created" | "updated" | "unchanged"> {
  const directory = path.dirname(targetPath);
  await mkdir(directory, { recursive: true });

  try {
    const existing = await readFile(targetPath, "utf8");

    if (existing === content) {
      return "unchanged";
    }

    await writeFile(targetPath, content, "utf8");
    return "updated";
  } catch {
    await writeFile(targetPath, content, "utf8");
    return "created";
  }
}

export async function renderFoundation(options: {
  cwd: string;
  manifest: Manifest;
  selection?: SelectionInput;
}): Promise<RenderSummary> {
  const templateFiles = await listTemplateFiles(options.selection);
  const created: string[] = [];
  const updated: string[] = [];
  const unchanged: string[] = [];

  function recordResult(result: "created" | "updated" | "unchanged", filePath: string): void {
    if (result === "created") {
      created.push(filePath);
      return;
    }

    if (result === "updated") {
      updated.push(filePath);
      return;
    }

    unchanged.push(filePath);
  }

  for (const templateFile of templateFiles) {
    const sourcePath = resolveTemplateSourcePath(templateFile);
    const repositoryPath = toRepositoryPath(templateFile);
    const targetPath = path.join(options.cwd, repositoryPath);
    const content = await readFile(sourcePath, "utf8");

    recordResult(await writeFileIfChanged(targetPath, content), repositoryPath);
  }

  const manifestJson = `${JSON.stringify(options.manifest, null, 2)}\n`;
  recordResult(
    await writeFileIfChanged(resolveManifestPath(options.cwd), manifestJson),
    ".agent-foundation/manifest.json"
  );

  const registryJson = `${JSON.stringify(profileRegistry, null, 2)}\n`;
  recordResult(
    await writeFileIfChanged(resolveProfileRegistryPath(options.cwd), registryJson),
    ".agent-foundation/profile-registry.json"
  );

  const providerProjectionsPath = ".agent-foundation/provider-projections.json";
  const providerProjectionsJson = `${JSON.stringify(buildProviderProjectionManifest(), null, 2)}\n`;
  recordResult(
    await writeFileIfChanged(path.join(options.cwd, providerProjectionsPath), providerProjectionsJson),
    providerProjectionsPath
  );

  const contextBudgetPath = ".agent-foundation/context-budget.json";
  const contextBudgetJson = `${JSON.stringify(
    buildContextBudgetManifest(
      [
        ...created,
        ...updated,
        ...unchanged,
        ".agent-foundation/manifest.json",
        ".agent-foundation/profile-registry.json",
        providerProjectionsPath,
        contextBudgetPath
      ]
    ),
    null,
    2
  )}\n`;
  recordResult(
    await writeFileIfChanged(path.join(options.cwd, contextBudgetPath), contextBudgetJson),
    contextBudgetPath
  );

  return {
    created: created.sort(),
    updated: updated.sort(),
    unchanged: unchanged.sort()
  };
}

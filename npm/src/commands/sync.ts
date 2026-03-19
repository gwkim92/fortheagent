import { readdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { classifyFile } from "../lib/file-ownership.js";
import { parseManifest, validateManifest } from "../lib/manifest.js";
import {
  detectRepositoryRoot,
  resolveManifestPath,
  resolveProfileRegistryPath
} from "../lib/paths.js";
import {
  collectExpectedTemplateRoots,
  collectExpectedOutputs,
  collectKnownOverlayOutputs,
  loadProfileRegistry,
  validateProfileRegistry,
  validateProfileRegistryTemplates
} from "../lib/profile-registry.js";
import { renderFoundation } from "../lib/render.js";
import { applyDefaultWorkflowState } from "../lib/workflow-state.js";

async function walkRepositoryFiles(directory: string, root = directory): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .filter((entry) => entry.name !== "node_modules" && entry.name !== "dist")
      .map(async (entry) => {
        const fullPath = path.join(directory, entry.name);

        if (entry.isDirectory()) {
          return walkRepositoryFiles(fullPath, root);
        }

        return [path.relative(root, fullPath)];
      })
  );

  return nested.flat().sort();
}

export async function runSync(options: {
  cwd: string;
  dryRun?: boolean;
  repair?: boolean;
  prune?: boolean;
}): Promise<{
  updated: string[];
  skipped: string[];
  conflicted: string[];
  pruned: string[];
}> {
  const cwd = await detectRepositoryRoot(options.cwd);
  const registryContents = await readFile(resolveProfileRegistryPath(cwd), "utf8");
  const { registry } = loadProfileRegistry(JSON.parse(registryContents));
  const registryErrors = [...validateProfileRegistry(registry)];

  const manifestContents = await readFile(resolveManifestPath(cwd), "utf8");
  const manifest = applyDefaultWorkflowState(parseManifest(JSON.parse(manifestContents)));
  const manifestErrors = validateManifest(manifest, registry);

  const templateErrors = await validateProfileRegistryTemplates(
    collectExpectedTemplateRoots(manifest, registry)
  );
  const allErrors = [...registryErrors, ...manifestErrors, ...templateErrors];

  if (allErrors.length > 0) {
    throw new Error(allErrors.join("\n"));
  }

  const summary = await renderFoundation({
    cwd,
    manifest,
    registry,
    dryRun: options.dryRun,
    repair: options.repair
  });

  const existingFiles = await walkRepositoryFiles(cwd);
  const skipped = existingFiles.filter((filePath) => classifyFile(filePath) === "user-owned");
  const expectedOutputs = collectExpectedOutputs(manifest, registry);
  const staleManagedOutputs = collectKnownOverlayOutputs(registry).filter(
    (filePath) =>
      !expectedOutputs.includes(filePath) && classifyFile(filePath) === "managed"
  );
  const pruned: string[] = [];

  if (options.prune) {
    for (const staleOutput of staleManagedOutputs) {
      const targetPath = path.join(cwd, staleOutput);

      try {
        await readFile(targetPath, "utf8");
      } catch {
        continue;
      }

      if (!options.dryRun) {
        await rm(targetPath, { force: true });
      }

      pruned.push(staleOutput);
    }
  }

  return {
    updated: summary.updated,
    skipped,
    conflicted: summary.conflicted,
    pruned: pruned.sort()
  };
}

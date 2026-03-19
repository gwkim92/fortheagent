import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Manifest } from "./manifest.js";
import {
  collectExpectedTemplateRoots,
  profileRegistry,
  type ProfileRegistry
} from "./profile-registry.js";
import { resolveTemplatesRoot } from "./paths.js";

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(fullPath);
      }

      return [fullPath];
    })
  );

  return files.flat();
}

export async function listBaseTemplateFiles(): Promise<string[]> {
  const root = resolveTemplatesRoot();
  const files = await walkFiles(path.join(root, "base"));

  return files
    .map((filePath) => path.relative(root, filePath))
    .map((filePath) => `templates/${filePath}`)
    .filter((filePath) => filePath !== "templates/base/.agent-foundation/profile-registry.json")
    .sort();
}

async function listFilesForTemplateRoots(templateRoots: string[]): Promise<string[]> {
  const root = resolveTemplatesRoot();
  const files = await Promise.all(
    templateRoots.map(async (templateRoot) => {
      const directory = path.join(root, templateRoot.replace(/^templates\//, ""));
      const rootFiles = await walkFiles(directory);

      return rootFiles
        .map((filePath) => path.relative(root, filePath))
        .map((filePath) => `templates/${filePath}`);
    })
  );

  return files.flat().sort();
}

export async function listTemplateFiles(
  manifest?: Manifest,
  registry: ProfileRegistry = profileRegistry
): Promise<string[]> {
  const baseFiles = await listBaseTemplateFiles();

  if (!manifest || manifest.status !== "resolved") {
    return baseFiles;
  }

  const overlayFiles = await listFilesForTemplateRoots(
    collectExpectedTemplateRoots(manifest, registry)
  );

  return Array.from(new Set([...baseFiles, ...overlayFiles])).sort();
}

export function toRepositoryPath(templatePath: string): string {
  const normalized = templatePath.replace(/^templates\//, "");
  const segments = normalized.split(path.sep);

  if (segments[0] === "base") {
    return segments.slice(1).join(path.sep);
  }

  if (
    segments[0] === "phase" ||
    segments[0] === "frontend" ||
    segments[0] === "backend" ||
    segments[0] === "system" ||
    segments[0] === "quality" ||
    segments[0] === "practice" ||
    segments[0] === "constraints"
  ) {
    return segments.slice(2).join(path.sep);
  }

  return normalized;
}

export function resolveTemplateSourcePath(templatePath: string): string {
  return path.join(resolveTemplatesRoot(), templatePath.replace(/^templates\//, ""));
}

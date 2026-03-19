import { readdir } from "node:fs/promises";
import path from "node:path";
import { resolveCliRoot, resolveTemplatesRoot } from "./paths.js";
import { resolveTemplatePaths, type SelectionInput } from "./selection.js";

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
    .sort();
}

export async function listTemplateFiles(selection?: SelectionInput): Promise<string[]> {
  const baseFiles = await listBaseTemplateFiles();

  if (!selection) {
    return baseFiles;
  }

  return Array.from(new Set([...baseFiles, ...resolveTemplatePaths(selection)])).sort();
}

export function toRepositoryPath(templatePath: string): string {
  const normalized = templatePath.replace(/^templates\//, "");
  const segments = normalized.split(path.sep);

  if (segments[0] === "base") {
    return segments.slice(1).join(path.sep);
  }

  if (segments[0] === "frontend" || segments[0] === "backend" || segments[0] === "system") {
    return segments.slice(2).join(path.sep);
  }

  return normalized;
}

export function resolveTemplateSourcePath(templatePath: string): string {
  return path.join(resolveCliRoot(), templatePath.replace(/^templates\//, "templates/"));
}

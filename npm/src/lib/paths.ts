import { access } from "node:fs/promises";
import path from "node:path";

export function resolvePackageRoot(): string {
  return path.resolve(import.meta.dirname, "..", "..");
}

export function resolveTemplatesRoot(): string {
  return path.join(resolvePackageRoot(), "templates");
}

export function resolveDistCliPath(): string {
  return path.join(resolvePackageRoot(), "dist", "cli.js");
}

export function resolveManifestPath(cwd: string): string {
  return path.join(cwd, ".agent-foundation", "manifest.json");
}

export function resolveProfileRegistryPath(cwd: string): string {
  return path.join(cwd, ".agent-foundation", "profile-registry.json");
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function detectRepositoryRoot(cwd: string): Promise<string> {
  const start = path.resolve(cwd);
  let current = start;
  let packageRoot: string | null = null;
  let workspaceRoot: string | null = null;

  for (;;) {
    if (await pathExists(resolveManifestPath(current))) {
      return current;
    }

    if (await pathExists(path.join(current, ".git"))) {
      return current;
    }

    if (await pathExists(path.join(current, "pnpm-workspace.yaml"))) {
      workspaceRoot = current;
    }

    if (packageRoot === null && (await pathExists(path.join(current, "package.json")))) {
      packageRoot = current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      break;
    }

    current = parent;
  }

  return workspaceRoot ?? packageRoot ?? start;
}

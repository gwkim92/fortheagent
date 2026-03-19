import os from "node:os";
import path from "node:path";

export function resolveCliRoot(): string {
  return path.resolve(import.meta.dirname, "..", "..");
}

export function resolveTemplatesRoot(): string {
  return path.join(resolveCliRoot(), "templates");
}

export function resolveManifestPath(cwd: string): string {
  return path.join(cwd, ".agent-foundation", "manifest.json");
}

export function resolveProfileRegistryPath(cwd: string): string {
  return path.join(cwd, ".agent-foundation", "profile-registry.json");
}

export function resolveFoundationHome(): string {
  const override = process.env.FOUNDATION_HOME;

  if (override) {
    return path.resolve(override);
  }

  return path.join(os.homedir(), ".foundation-cli");
}

export function resolveProviderConfigPath(): string {
  return path.join(resolveFoundationHome(), "config.json");
}

export function resolveProviderCredentialsPath(): string {
  return path.join(resolveFoundationHome(), "credentials.json");
}

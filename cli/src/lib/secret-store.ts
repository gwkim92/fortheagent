import { execFile } from "node:child_process";
import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { providerIds, type ProviderId } from "../providers/types.js";
import { resolveFoundationHome, resolveProviderCredentialsPath } from "./paths.js";

type SecretBackend = "file" | "keychain";
type SecretBackendMode = {
  backend: SecretBackend;
  allowFileFallback: boolean;
};
type ExecResult = {
  stdout: string;
  stderr: string;
};
type CommandRunner = (file: string, args: string[]) => Promise<ExecResult>;

const execFileAsync = promisify(execFile);
const keychainAccount = "foundation-cli";

let commandRunner: CommandRunner = async (file, args) => {
  const result = await execFileAsync(file, args, {
    encoding: "utf8"
  });

  return {
    stdout: result.stdout,
    stderr: result.stderr
  };
};

let backendModeOverride: SecretBackendMode | null = null;

function resolveSecretBackendMode(): SecretBackendMode {
  if (backendModeOverride) {
    return backendModeOverride;
  }

  const override = process.env.FOUNDATION_SECRET_BACKEND;

  if (override === "file") {
    return {
      backend: "file",
      allowFileFallback: false
    };
  }

  if (override === "keychain") {
    return {
      backend: "keychain",
      allowFileFallback: false
    };
  }

  if (process.env.FOUNDATION_HOME) {
    return {
      backend: "file",
      allowFileFallback: false
    };
  }

  if (process.platform === "darwin") {
    return {
      backend: "keychain",
      allowFileFallback: true
    };
  }

  return {
    backend: "file",
    allowFileFallback: false
  };
}

function getKeychainService(providerId: ProviderId): string {
  return `com.company.foundation-cli.provider.${providerId}`;
}

async function ensureStoreDirectory(): Promise<void> {
  await mkdir(resolveFoundationHome(), { recursive: true });
}

async function readFileSecrets(): Promise<Record<string, string>> {
  try {
    const contents = await readFile(resolveProviderCredentialsPath(), "utf8");
    const parsed = JSON.parse(contents) as {
      version?: string;
      providers?: Record<string, unknown>;
    };

    if (parsed.version !== "1" || !parsed.providers) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(parsed.providers).map(([providerId, value]) => [
        providerId,
        typeof value === "string" ? value : JSON.stringify(value)
      ])
    );

  } catch {
    return {};
  }
}

async function writeFileSecrets(secrets: Record<string, string>): Promise<void> {
  await ensureStoreDirectory();
  const providers = Object.fromEntries(
    Object.entries(secrets).map(([providerId, value]) => {
      try {
        return [providerId, JSON.parse(value)];
      } catch {
        return [providerId, value];
      }
    })
  );
  await writeFile(
    resolveProviderCredentialsPath(),
    `${JSON.stringify({ version: "1", providers }, null, 2)}\n`,
    {
      encoding: "utf8",
      mode: 0o600
    }
  );
  await chmod(resolveProviderCredentialsPath(), 0o600);
}

function shouldFallback(error: unknown, mode: SecretBackendMode): boolean {
  return mode.backend === "keychain" && mode.allowFileFallback;
}

function isMissingKeychainEntry(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const stderr =
    "stderr" in error && typeof error.stderr === "string" ? error.stderr.toLowerCase() : "";
  const code = "code" in error ? error.code : null;

  return code === 44 || stderr.includes("could not be found");
}

async function readKeychainSecret(providerId: ProviderId): Promise<string | null> {
  try {
    const result = await commandRunner("security", [
      "find-generic-password",
      "-a",
      keychainAccount,
      "-s",
      getKeychainService(providerId),
      "-w"
    ]);

    return result.stdout.trim() || null;
  } catch (error) {
    if (isMissingKeychainEntry(error)) {
      return null;
    }

    throw error;
  }
}

async function writeKeychainSecret(providerId: ProviderId, secret: string): Promise<void> {
  await commandRunner("security", [
    "add-generic-password",
    "-U",
    "-a",
    keychainAccount,
    "-s",
    getKeychainService(providerId),
    "-w",
    secret
  ]);
}

async function deleteKeychainSecret(providerId: ProviderId): Promise<void> {
  try {
    await commandRunner("security", [
      "delete-generic-password",
      "-a",
      keychainAccount,
      "-s",
      getKeychainService(providerId)
    ]);
  } catch (error) {
    if (isMissingKeychainEntry(error)) {
      return;
    }

    throw error;
  }
}

export async function readSecret(providerId: ProviderId): Promise<string | null> {
  const mode = resolveSecretBackendMode();

  if (mode.backend === "file") {
    const secrets = await readFileSecrets();
    return secrets[providerId] ?? null;
  }

  try {
    return await readKeychainSecret(providerId);
  } catch (error) {
    if (!shouldFallback(error, mode)) {
      throw error;
    }

    const secrets = await readFileSecrets();
    return secrets[providerId] ?? null;
  }
}

export async function writeSecret(providerId: ProviderId, secret: string): Promise<void> {
  const mode = resolveSecretBackendMode();

  if (mode.backend === "file") {
    const secrets = await readFileSecrets();
    secrets[providerId] = secret;
    await writeFileSecrets(secrets);
    return;
  }

  try {
    await writeKeychainSecret(providerId, secret);
  } catch (error) {
    if (!shouldFallback(error, mode)) {
      throw error;
    }

    const secrets = await readFileSecrets();
    secrets[providerId] = secret;
    await writeFileSecrets(secrets);
  }
}

export async function deleteSecret(providerId: ProviderId): Promise<void> {
  const mode = resolveSecretBackendMode();

  if (mode.backend === "file") {
    const secrets = await readFileSecrets();
    delete secrets[providerId];
    await writeFileSecrets(secrets);
    return;
  }

  try {
    await deleteKeychainSecret(providerId);
  } catch (error) {
    if (!shouldFallback(error, mode)) {
      throw error;
    }

    const secrets = await readFileSecrets();
    delete secrets[providerId];
    await writeFileSecrets(secrets);
  }
}

export async function readAllSecrets(): Promise<Record<string, string>> {
  const secrets: Record<string, string> = {};

  for (const providerId of providerIds) {
    const value = await readSecret(providerId);

    if (value) {
      secrets[providerId] = value;
    }
  }

  return secrets;
}

export async function writeAllSecrets(secrets: Record<string, string>): Promise<void> {
  for (const providerId of providerIds) {
    if (providerId in secrets) {
      await writeSecret(providerId, secrets[providerId] ?? "");
    } else {
      await deleteSecret(providerId);
    }
  }
}

export function resolveSecretBackend(): SecretBackend {
  return resolveSecretBackendMode().backend;
}

export function configureSecretStoreForTests(options: {
  commandRunner?: CommandRunner;
  backendMode?: SecretBackendMode | null;
}): void {
  commandRunner = options.commandRunner ?? commandRunner;
  backendModeOverride =
    options.backendMode === undefined ? backendModeOverride : options.backendMode;
}

export function resetSecretStoreForTests(): void {
  commandRunner = async (file, args) => {
    const result = await execFileAsync(file, args, {
      encoding: "utf8"
    });

    return {
      stdout: result.stdout,
      stderr: result.stderr
    };
  };
  backendModeOverride = null;
}

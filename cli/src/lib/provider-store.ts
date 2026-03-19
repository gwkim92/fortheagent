import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
  resolveFoundationHome,
  resolveProviderConfigPath
} from "./paths.js";
import { providerIds, type ProviderId } from "../providers/types.js";
import {
  deleteSecret,
  readAllSecrets,
  writeAllSecrets
} from "./secret-store.js";

const providerIdSchema = z.enum(providerIds);

const localProviderConfigSchema = z.object({
  id: z.union([z.literal("codex-local"), z.literal("claude-local")]),
  kind: z.literal("local"),
  executablePath: z.string()
});

const apiKeyProviderConfigSchema = z.object({
  id: z.union([z.literal("openai-api"), z.literal("anthropic-api")]),
  kind: z.literal("api-key"),
  model: z.string(),
  apiBaseUrl: z.string().nullable().default(null)
});

const hostedOauthProviderConfigSchema = z.object({
  id: z.literal("hosted-oauth"),
  kind: z.literal("oauth"),
  clientId: z.string(),
  authorizeUrl: z.string(),
  tokenUrl: z.string(),
  apiBaseUrl: z.string(),
  model: z.string(),
  scopes: z.array(z.string())
});

const providerConfigSchema = z.discriminatedUnion("kind", [
  localProviderConfigSchema,
  apiKeyProviderConfigSchema,
  hostedOauthProviderConfigSchema
]);

const configSchema = z.object({
  version: z.literal("1"),
  defaultProvider: providerIdSchema.nullable().default(null),
  providers: z.record(z.string(), providerConfigSchema).default({})
});

const providerCredentialSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("api-key"),
    apiKey: z.string()
  }),
  z.object({
    kind: z.literal("oauth"),
    accessToken: z.string(),
    refreshToken: z.string().nullable().default(null),
    expiresAt: z.string().nullable().default(null),
    tokenType: z.string().default("Bearer")
  })
]);

const credentialsSchema = z.object({
  version: z.literal("1"),
  providers: z.record(z.string(), providerCredentialSchema).default({})
});

export type ProviderConfig = z.infer<typeof providerConfigSchema>;
export type ProviderCredential = z.infer<typeof providerCredentialSchema>;
export type StoredProviderConfig = z.infer<typeof configSchema>;
export type StoredProviderCredentials = z.infer<typeof credentialsSchema>;

async function ensureConfigDirectory(): Promise<void> {
  await mkdir(resolveFoundationHome(), { recursive: true });
}

async function writeSecureJson(filePath: string, payload: unknown): Promise<void> {
  await ensureConfigDirectory();
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600
  });
  await chmod(filePath, 0o600);
}

async function readJsonFile<T>(filePath: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  try {
    const contents = await readFile(filePath, "utf8");
    return schema.parse(JSON.parse(contents));
  } catch {
    return fallback;
  }
}

export async function readProviderConfig(): Promise<StoredProviderConfig> {
  return readJsonFile(resolveProviderConfigPath(), configSchema, {
    version: "1",
    defaultProvider: null,
    providers: {}
  });
}

export async function writeProviderConfig(config: StoredProviderConfig): Promise<void> {
  await writeSecureJson(resolveProviderConfigPath(), configSchema.parse(config));
}

export async function readProviderCredentials(): Promise<StoredProviderCredentials> {
  const rawSecrets = await readAllSecrets();
  const providers: Record<string, ProviderCredential> = {};

  for (const [providerId, rawSecret] of Object.entries(rawSecrets)) {
    try {
      providers[providerId] = providerCredentialSchema.parse(JSON.parse(rawSecret));
    } catch {
      continue;
    }
  }

  return credentialsSchema.parse({
    version: "1",
    providers
  });
}

export async function writeProviderCredentials(
  credentials: StoredProviderCredentials
): Promise<void> {
  const parsed = credentialsSchema.parse(credentials);
  const serializedSecrets = Object.fromEntries(
    Object.entries(parsed.providers).map(([providerId, credential]) => [
      providerId,
      JSON.stringify(credential)
    ])
  );

  await writeAllSecrets(serializedSecrets);
}

export async function upsertProviderConfig(provider: ProviderConfig): Promise<void> {
  const config = await readProviderConfig();
  config.providers[provider.id] = provider;
  await writeProviderConfig(config);
}

export async function removeProviderConfig(providerId: ProviderId): Promise<void> {
  const config = await readProviderConfig();
  delete config.providers[providerId];
  if (config.defaultProvider === providerId) {
    config.defaultProvider = null;
  }
  await writeProviderConfig(config);
}

export async function setDefaultProvider(providerId: ProviderId | null): Promise<void> {
  const config = await readProviderConfig();
  config.defaultProvider = providerId;
  await writeProviderConfig(config);
}

export async function upsertProviderCredential(
  providerId: ProviderId,
  credential: ProviderCredential
): Promise<void> {
  const credentials = await readProviderCredentials();
  credentials.providers[providerId] = credential;
  await writeProviderCredentials(credentials);
}

export async function removeProviderCredential(providerId: ProviderId): Promise<void> {
  await deleteSecret(providerId);
}

export function resolveProviderDefaults(providerId: ProviderId): {
  model: string;
  apiBaseUrl: string | null;
} {
  switch (providerId) {
    case "openai-api":
      return {
        model: "gpt-5",
        apiBaseUrl: "https://api.openai.com/v1"
      };
    case "anthropic-api":
      return {
        model: "claude-sonnet-4-5",
        apiBaseUrl: "https://api.anthropic.com/v1"
      };
    default:
      return {
        model: "",
        apiBaseUrl: null
      };
  }
}

export function resolveProviderConfigFile(): string {
  return path.relative(process.cwd(), resolveProviderConfigPath());
}

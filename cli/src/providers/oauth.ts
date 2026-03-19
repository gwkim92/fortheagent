import crypto from "node:crypto";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { openUrl as openExternalUrl } from "../lib/open-url.js";
import { promptForText } from "../lib/terminal.js";
import {
  readProviderConfig,
  readProviderCredentials,
  removeProviderConfig,
  removeProviderCredential,
  upsertProviderConfig,
  upsertProviderCredential
} from "../lib/provider-store.js";
import type { SessionMessage } from "../lib/session.js";
import type { ProviderAdapter, ProviderStatus, ProviderTurnOptions, ProviderTurnResult } from "./types.js";

type FetchFn = typeof fetch;

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function createPkcePair(): { verifier: string; challenge: string } {
  const verifier = base64Url(crypto.randomBytes(32));
  const challenge = base64Url(crypto.createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

function buildOauthError(message: string): Error {
  return new Error(`OAuth flow failed: ${message}`);
}

function extractCompletionText(payload: unknown): string {
  if (
    payload &&
    typeof payload === "object" &&
    "choices" in payload &&
    Array.isArray(payload.choices)
  ) {
    const chunks = payload.choices
      .map((entry) => {
        if (
          entry &&
          typeof entry === "object" &&
          "message" in entry &&
          entry.message &&
          typeof entry.message === "object" &&
          "content" in entry.message
        ) {
          if (typeof entry.message.content === "string") {
            return entry.message.content;
          }

          if (Array.isArray(entry.message.content)) {
            return entry.message.content
              .map((content: unknown) =>
                content &&
                typeof content === "object" &&
                "text" in content &&
                typeof content.text === "string"
                  ? content.text
                  : ""
              )
              .filter(Boolean)
              .join("\n");
          }
        }

        return "";
      })
      .filter(Boolean);

    if (chunks.length > 0) {
      return chunks.join("\n");
    }
  }

  throw new Error("Unable to parse hosted-oauth response text");
}

async function postForm(fetchFn: FetchFn, url: string, body: URLSearchParams): Promise<unknown> {
  const response = await fetchFn(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    throw buildOauthError(`${response.status} ${response.statusText}`);
  }

  return response.json();
}

async function createLoopbackAuthorization(options: {
  authorizeUrl: URL;
  expectedState: string;
  output: NodeJS.WritableStream;
}): Promise<{
  url: string;
  waitForCode: Promise<string>;
}> {
  const { authorizeUrl, expectedState, output } = options;

  return new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const requestUrl = new URL(request.url ?? "/", authorizeUrl.origin);

      if (requestUrl.pathname !== "/callback") {
        response.statusCode = 404;
        response.end("Not found");
        return;
      }

      const error = requestUrl.searchParams.get("error");
      const state = requestUrl.searchParams.get("state");
      const code = requestUrl.searchParams.get("code");

      if (error) {
        response.statusCode = 400;
        response.end("OAuth authorization failed");
        server.close();
        waitForCodeReject(buildOauthError(error));
        return;
      }

      if (!state || state !== expectedState) {
        response.statusCode = 400;
        response.end("State mismatch");
        server.close();
        waitForCodeReject(buildOauthError("state mismatch"));
        return;
      }

      if (!code) {
        response.statusCode = 400;
        response.end("Missing authorization code");
        server.close();
        waitForCodeReject(buildOauthError("missing authorization code"));
        return;
      }

      response.statusCode = 200;
      response.end("Foundation CLI authorization complete. You can close this window.");
      server.close();
      waitForCodeResolve(code);
    });

    let waitForCodeResolve!: (value: string) => void;
    let waitForCodeReject!: (reason?: unknown) => void;
    const waitForCode = new Promise<string>((innerResolve, innerReject) => {
      waitForCodeResolve = innerResolve;
      waitForCodeReject = innerReject;
    });

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo | null;

      if (!address) {
        server.close();
        waitForCodeReject(buildOauthError("unable to bind loopback callback server"));
        return;
      }

      const redirectUri = `http://127.0.0.1:${address.port}/callback`;
      authorizeUrl.searchParams.set("redirect_uri", redirectUri);
      const url = authorizeUrl.toString();
      output.write(`Open this URL to complete login:\n${url}\n`);
      resolve({
        url,
        waitForCode
      });
    });
  });
}

function normalizeScopes(rawScopes: unknown): string[] {
  if (!rawScopes) {
    return [];
  }

  if (Array.isArray(rawScopes)) {
    return rawScopes
      .map((scope) => (typeof scope === "string" ? scope.trim() : ""))
      .filter(Boolean);
  }

  if (typeof rawScopes === "string") {
    return rawScopes
      .split(",")
      .map((scope) => scope.trim())
      .filter(Boolean);
  }

  return [];
}

function computeExpiry(expiresIn: unknown): string | null {
  if (typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function ensureAccessToken(fetchFn: FetchFn): Promise<{
  config: Extract<Awaited<ReturnType<typeof readProviderConfig>>, { version: "1" }>["providers"]["hosted-oauth"] & { kind: "oauth" };
  accessToken: string;
}> {
  const config = await readProviderConfig();
  const credentials = await readProviderCredentials();
  const storedConfig = config.providers["hosted-oauth"];
  const storedCredential = credentials.providers["hosted-oauth"];

  if (storedConfig?.kind !== "oauth" || storedCredential?.kind !== "oauth") {
    throw new Error("Provider hosted-oauth is not configured");
  }

  if (!storedCredential.expiresAt || new Date(storedCredential.expiresAt).getTime() > Date.now()) {
    return {
      config: storedConfig,
      accessToken: storedCredential.accessToken
    };
  }

  if (!storedCredential.refreshToken) {
    throw buildOauthError("access token expired and no refresh token is available");
  }

  const payload = (await postForm(
    fetchFn,
    storedConfig.tokenUrl,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: storedCredential.refreshToken,
      client_id: storedConfig.clientId
    })
  )) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
  };

  if (!payload.access_token) {
    throw buildOauthError("refresh response did not include access_token");
  }

  await upsertProviderCredential("hosted-oauth", {
    kind: "oauth",
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? storedCredential.refreshToken,
    expiresAt: computeExpiry(payload.expires_in),
    tokenType: payload.token_type ?? "Bearer"
  });

  return {
    config: storedConfig,
    accessToken: payload.access_token
  };
}

export function createHostedOauthAdapter(
  dependencies: {
    fetchFn?: FetchFn;
    openUrl?: (url: string) => Promise<void> | void;
    createAuthorization?: typeof createLoopbackAuthorization;
  } = {}
): ProviderAdapter {
  const fetchFn = dependencies.fetchFn ?? fetch;
  const createAuthorization = dependencies.createAuthorization ?? createLoopbackAuthorization;

  async function buildStatus(): Promise<ProviderStatus> {
    const config = await readProviderConfig();
    const credentials = await readProviderCredentials();
    const storedConfig = config.providers["hosted-oauth"];
    const storedCredential = credentials.providers["hosted-oauth"];

    return {
      id: "hosted-oauth",
      kind: "oauth",
      installed: true,
      configured: storedConfig?.kind === "oauth",
      authenticated: storedCredential?.kind === "oauth",
      isDefault: config.defaultProvider === "hosted-oauth",
      detail:
        storedConfig?.kind === "oauth" && storedCredential?.kind === "oauth"
          ? "ready"
          : "requires OAuth login",
      model: storedConfig?.kind === "oauth" ? storedConfig.model : null
    };
  }

  return {
    id: "hosted-oauth",
    kind: "oauth",
    detect: buildStatus,
    status: buildStatus,
    async login(loginOptions) {
      const output =
        loginOptions.streams &&
        typeof loginOptions.streams === "object" &&
        "output" in loginOptions.streams
          ? (loginOptions.streams.output as NodeJS.WritableStream | undefined)
          : undefined;

      const clientId =
        typeof loginOptions.clientId === "string" ? loginOptions.clientId.trim() : "";
      const authorizeUrl =
        typeof loginOptions.authorizeUrl === "string" ? loginOptions.authorizeUrl.trim() : "";
      const tokenUrl =
        typeof loginOptions.tokenUrl === "string" ? loginOptions.tokenUrl.trim() : "";
      const apiBaseUrl =
        typeof loginOptions.apiBaseUrl === "string" ? loginOptions.apiBaseUrl.trim() : "";
      const model =
        typeof loginOptions.model === "string" && loginOptions.model
          ? loginOptions.model
          : await promptForText("hosted-oauth model: ", loginOptions.streams as ProviderTurnOptions["streams"] ?? {});
      const scopes = normalizeScopes(loginOptions.scopes);

      if (!clientId || !authorizeUrl || !tokenUrl || !apiBaseUrl || !model) {
        throw new Error(
          "hosted-oauth login requires --client-id, --authorize-url, --token-url, --api-base-url, and --model"
        );
      }

      const authorize = new URL(authorizeUrl);
      const { verifier, challenge } = createPkcePair();
      const state = crypto.randomUUID();
      authorize.searchParams.set("response_type", "code");
      authorize.searchParams.set("client_id", clientId);
      authorize.searchParams.set("code_challenge_method", "S256");
      authorize.searchParams.set("code_challenge", challenge);
      authorize.searchParams.set("state", state);
      if (scopes.length > 0) {
        authorize.searchParams.set("scope", scopes.join(" "));
      }

      const authorization = await createAuthorization({
        authorizeUrl: authorize,
        expectedState: state,
        output: output ?? process.stdout
      });

      try {
        await (dependencies.openUrl ?? openExternalUrl)(authorization.url);
      } catch {
        // The callback URL is already printed, so login can continue even if the launcher fails.
      }

      const code = await authorization.waitForCode;
      const redirectUri = authorize.searchParams.get("redirect_uri");

      if (!redirectUri) {
        throw buildOauthError("redirect URI was not established");
      }

      const tokenPayload = (await postForm(
        fetchFn,
        tokenUrl,
        new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_verifier: verifier
        })
      )) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        token_type?: string;
      };

      if (!tokenPayload.access_token) {
        throw buildOauthError("token response did not include access_token");
      }

      await upsertProviderConfig({
        id: "hosted-oauth",
        kind: "oauth",
        clientId,
        authorizeUrl,
        tokenUrl,
        apiBaseUrl,
        model,
        scopes
      });
      await upsertProviderCredential("hosted-oauth", {
        kind: "oauth",
        accessToken: tokenPayload.access_token,
        refreshToken: tokenPayload.refresh_token ?? null,
        expiresAt: computeExpiry(tokenPayload.expires_in),
        tokenType: tokenPayload.token_type ?? "Bearer"
      });

      return buildStatus();
    },
    async logout() {
      await removeProviderCredential("hosted-oauth");
      await removeProviderConfig("hosted-oauth");
    },
    async sendTurn(sessionContext, input, turnOptions): Promise<ProviderTurnResult> {
      const { config, accessToken } = await ensureAccessToken(fetchFn);
      const systemPrompt =
        input.history.find((message: SessionMessage) => message.role === "system")?.content ??
        sessionContext.startupPrompt;
      const request = {
        model: config.model,
        messages: [
          { role: "system", content: systemPrompt },
          ...input.history
            .filter((message) => message.role === "user" || message.role === "assistant")
            .map((message) => ({
              role: message.role as "user" | "assistant",
              content: message.content
            })),
          { role: "user", content: input.userMessage }
        ]
      };

      if (turnOptions.dryRun) {
        return {
          provider: "hosted-oauth",
          kind: "oauth",
          request,
          responseText: ""
        };
      }

      await turnOptions.onEvent?.({
        type: "status",
        message: "Sending turn to Hosted OAuth"
      });

      const response = await fetchFn(`${config.apiBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        throw buildOauthError(`${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const responseText = extractCompletionText(payload);

      await turnOptions.onEvent?.({
        type: "done"
      });

      return {
        provider: "hosted-oauth",
        kind: "oauth",
        request,
        responseText
      };
    }
  };
}

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { runCreate } from "../../src/commands/create.js";
import { buildSessionContext } from "../../src/lib/repository-context.js";
import { createSessionHistory } from "../../src/lib/session.js";
import { upsertProviderCredential } from "../../src/lib/provider-store.js";
import { createHostedOauthAdapter } from "../../src/providers/oauth.js";

async function withFoundationHome<T>(run: () => Promise<T>): Promise<T> {
  const previous = process.env.FOUNDATION_HOME;
  const foundationHome = await mkdtemp(path.join(tmpdir(), "foundation-cli-oauth-home-"));
  process.env.FOUNDATION_HOME = foundationHome;

  try {
    return await run();
  } finally {
    if (previous) {
      process.env.FOUNDATION_HOME = previous;
    } else {
      delete process.env.FOUNDATION_HOME;
    }

    await rm(foundationHome, { recursive: true, force: true });
  }
}

function parseFormBody(body: BodyInit | null | undefined): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body?.toString() ?? "").entries());
}

describe("hosted oauth provider", () => {
  it("completes login through a loopback callback", async () => {
    await withFoundationHome(async () => {
      const tokenRequests: Array<Record<string, string>> = [];
      let authorizationUrl = "";

      const adapter = createHostedOauthAdapter({
        createAuthorization: async ({ authorizeUrl }) => {
          authorizeUrl.searchParams.set("redirect_uri", "http://127.0.0.1/callback");
          authorizationUrl = authorizeUrl.toString();
          return {
            url: authorizationUrl,
            waitForCode: Promise.resolve("oauth-code")
          };
        },
        fetchFn: async (input, init) => {
          if (input.toString() === "https://oauth.example/token") {
            tokenRequests.push(parseFormBody(init?.body));
            return new Response(
              JSON.stringify({
                access_token: "oauth-access-token",
                refresh_token: "oauth-refresh-token",
                expires_in: 3600,
                token_type: "Bearer"
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json"
                }
              }
            );
          }

          return new Response("not found", { status: 404 });
        }
      });

      const status = await adapter.login({
        clientId: "client-id",
        authorizeUrl: "https://oauth.example/authorize",
        tokenUrl: "https://oauth.example/token",
        apiBaseUrl: "https://oauth.example/v1",
        model: "gpt-5",
        scopes: ["chat:write"]
      });

      expect(status.configured).toBe(true);
      expect(status.authenticated).toBe(true);
      expect(authorizationUrl).toContain("client_id=client-id");
      expect(authorizationUrl).toContain("scope=chat%3Awrite");
      expect(tokenRequests[0]).toMatchObject({
        grant_type: "authorization_code",
        code: "oauth-code",
        client_id: "client-id",
        redirect_uri: "http://127.0.0.1/callback"
      });
    });
  });

  it("refreshes an expired token before starting", async () => {
    await withFoundationHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-oauth-repo-"));
      const refreshRequests: Array<Record<string, string>> = [];
      const authHeaders: string[] = [];

      await runCreate({
        cwd,
        answerSet: {
          frontend: "next",
          backend: "nest",
          systemType: "b2b-saas",
          architectureStyle: "service-oriented",
          constraints: ["auth", "multi-tenant"]
        }
      });

      const adapter = createHostedOauthAdapter({
        createAuthorization: async ({ authorizeUrl }) => {
          authorizeUrl.searchParams.set("redirect_uri", "http://127.0.0.1/callback");
          return {
            url: authorizeUrl.toString(),
            waitForCode: Promise.resolve("oauth-code")
          };
        },
        fetchFn: async (input, init) => {
          if (input.toString() === "https://oauth.example/token") {
            const params = parseFormBody(init?.body);
            refreshRequests.push(params);

            if (params.grant_type === "authorization_code") {
              return new Response(
                JSON.stringify({
                  access_token: "oauth-access-token",
                  refresh_token: "oauth-refresh-token",
                  expires_in: 1,
                  token_type: "Bearer"
                }),
                {
                  status: 200,
                  headers: {
                    "content-type": "application/json"
                  }
                }
              );
            }

            return new Response(
              JSON.stringify({
                access_token: "refreshed-token",
                refresh_token: "oauth-refresh-token",
                expires_in: 3600,
                token_type: "Bearer"
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json"
                }
              }
            );
          }

          if (input.toString() === "https://oauth.example/v1/chat/completions") {
            authHeaders.push(init?.headers instanceof Headers ? init.headers.get("authorization") ?? "" : (init?.headers as Record<string, string>)?.Authorization ?? "");
            return new Response(
              JSON.stringify({
                choices: [{ message: { content: "oauth reply" } }]
              }),
              {
                status: 200,
                headers: {
                  "content-type": "application/json"
                }
              }
            );
          }

          return new Response("not found", { status: 404 });
        }
      });

      await adapter.login({
        clientId: "client-id",
        authorizeUrl: "https://oauth.example/authorize",
        tokenUrl: "https://oauth.example/token",
        apiBaseUrl: "https://oauth.example/v1",
        model: "gpt-5"
      });

      await upsertProviderCredential("hosted-oauth", {
        kind: "oauth",
        accessToken: "expired-token",
        refreshToken: "oauth-refresh-token",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        tokenType: "Bearer"
      });

      const context = await buildSessionContext(cwd, "Assess the tenancy model");
      const result = await adapter.sendTurn(
        context,
        {
          history: createSessionHistory(context),
          userMessage: "Assess the tenancy model"
        },
        {}
      );

      expect(result.responseText).toBe("oauth reply");
      expect(refreshRequests.at(-1)?.grant_type).toBe("refresh_token");
      expect(authHeaders).toContain("Bearer refreshed-token");
    });
  });

  it("fails when refresh token exchange fails", async () => {
    await withFoundationHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-oauth-failure-repo-"));

      await runCreate({
        cwd,
        answerSet: {
          frontend: "next",
          backend: "nest",
          systemType: "internal-tool",
          architectureStyle: "modular-monolith",
          constraints: ["auth"]
        }
      });

      const adapter = createHostedOauthAdapter({
        createAuthorization: async ({ authorizeUrl }) => {
          authorizeUrl.searchParams.set("redirect_uri", "http://127.0.0.1/callback");
          return {
            url: authorizeUrl.toString(),
            waitForCode: Promise.resolve("oauth-code")
          };
        },
        fetchFn: async (input, init) => {
          if (input.toString() === "https://oauth.example/token") {
            const params = parseFormBody(init?.body);

            if (params.grant_type === "authorization_code") {
              return new Response(
                JSON.stringify({
                  access_token: "oauth-access-token",
                  refresh_token: "oauth-refresh-token",
                  expires_in: 1,
                  token_type: "Bearer"
                }),
                {
                  status: 200,
                  headers: {
                    "content-type": "application/json"
                  }
                }
              );
            }

            return new Response(JSON.stringify({ error: "refresh_failed" }), {
              status: 500,
              headers: {
                "content-type": "application/json"
              }
            });
          }

          return new Response("not found", { status: 404 });
        }
      });

      await adapter.login({
        clientId: "client-id",
        authorizeUrl: "https://oauth.example/authorize",
        tokenUrl: "https://oauth.example/token",
        apiBaseUrl: "https://oauth.example/v1",
        model: "gpt-5"
      });

      await upsertProviderCredential("hosted-oauth", {
        kind: "oauth",
        accessToken: "expired-token",
        refreshToken: "oauth-refresh-token",
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
        tokenType: "Bearer"
      });

      const context = await buildSessionContext(cwd, "Assess the design");

      await expect(
        adapter.sendTurn(
          context,
          {
            history: createSessionHistory(context),
            userMessage: "Assess the design"
          },
          {}
        )
      ).rejects.toThrow("OAuth flow failed");
    });
  });
});

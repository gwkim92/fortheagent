import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable, Writable } from "node:stream";
import { describe, expect, it } from "vitest";
import { runCreate } from "../../src/commands/create.js";
import { buildSessionContext } from "../../src/lib/repository-context.js";
import { createSessionHistory } from "../../src/lib/session.js";
import { createAnthropicAdapter, createOpenAiAdapter } from "../../src/providers/remote.js";

async function withFoundationHome<T>(run: (foundationHome: string) => Promise<T>): Promise<T> {
  const previous = process.env.FOUNDATION_HOME;
  const foundationHome = await mkdtemp(path.join(tmpdir(), "foundation-cli-provider-home-"));

  process.env.FOUNDATION_HOME = foundationHome;

  try {
    return await run(foundationHome);
  } finally {
    if (previous) {
      process.env.FOUNDATION_HOME = previous;
    } else {
      delete process.env.FOUNDATION_HOME;
    }

    await rm(foundationHome, { recursive: true, force: true });
  }
}

function readHeader(headers: HeadersInit | undefined, key: string): string | null {
  if (!headers) {
    return null;
  }

  if (headers instanceof Headers) {
    return headers.get(key);
  }

  if (Array.isArray(headers)) {
    const match = headers.find(([name]) => name.toLowerCase() === key.toLowerCase());
    return match?.[1] ?? null;
  }

  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === key.toLowerCase()) {
      return Array.isArray(value) ? value.join(",") : value?.toString() ?? null;
    }
  }

  return null;
}

describe("remote providers", () => {
  it("logs into OpenAI from env and sends the first request with session context", async () => {
    await withFoundationHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-openai-repo-"));
      const requests: Array<{ url: string; authorization: string | null; body: unknown }> = [];

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

      const adapter = createOpenAiAdapter({
        fetchFn: async (input, init) => {
          requests.push({
            url: input.toString(),
            authorization: readHeader(init?.headers, "authorization"),
            body: JSON.parse(init?.body?.toString() ?? "{}")
          });

          return new Response(JSON.stringify({ output_text: "openai reply" }), {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          });
        }
      });

      const previousKey = process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = "env-openai-key";

      try {
        await adapter.login({
          apiKeyEnv: "OPENAI_API_KEY",
          apiBaseUrl: "https://example.test/v1",
          model: "gpt-5"
        });

        const context = await buildSessionContext(cwd, "Summarize the architecture");
        const result = await adapter.sendTurn(
          context,
          {
            history: createSessionHistory(context),
            userMessage: "Summarize the architecture"
          },
          {}
        );

        expect(result.responseText).toBe("openai reply");
        expect(requests[0]?.url).toBe("https://example.test/v1/responses");
        expect(requests[0]?.authorization).toBe("Bearer env-openai-key");

        const payload = requests[0]?.body as {
          input: Array<{ role: string; content: Array<{ text: string }> }>;
        };
        expect(payload.input[0]?.content[0]?.text).toContain("frontend: next");
        expect(payload.input.at(-1)?.content[0]?.text).toBe("Summarize the architecture");
      } finally {
        if (previousKey) {
          process.env.OPENAI_API_KEY = previousKey;
        } else {
          delete process.env.OPENAI_API_KEY;
        }
      }
    });
  });

  it("supports prompt-based Anthropic login", async () => {
    await withFoundationHome(async () => {
      const cwd = await mkdtemp(path.join(tmpdir(), "foundation-cli-anthropic-repo-"));
      const requests: Array<{ url: string; apiKey: string | null; body: unknown }> = [];

      await runCreate({
        cwd,
        answerSet: {
          frontend: "react-spa",
          backend: "fastify",
          systemType: "api-platform",
          architectureStyle: "modular-monolith",
          constraints: ["realtime"]
        }
      });

      const adapter = createAnthropicAdapter({
        fetchFn: async (input, init) => {
          requests.push({
            url: input.toString(),
            apiKey: readHeader(init?.headers, "x-api-key"),
            body: JSON.parse(init?.body?.toString() ?? "{}")
          });

          return new Response(JSON.stringify({ content: [{ text: "anthropic reply" }] }), {
            status: 200,
            headers: {
              "content-type": "application/json"
            }
          });
        }
      });

      await adapter.login({
        apiBaseUrl: "https://example.test/v1",
        model: "claude-sonnet-4-5",
        streams: {
          input: Readable.from(["anthropic-test-key\n"]),
          output: new Writable({
            write(_chunk, _encoding, callback) {
              callback();
            }
          })
        }
      });

      const context = await buildSessionContext(cwd, "Inspect the service boundaries");
      const result = await adapter.sendTurn(
        context,
        {
          history: createSessionHistory(context),
          userMessage: "Inspect the service boundaries"
        },
        {}
      );

      expect(result.responseText).toBe("anthropic reply");
      expect(requests[0]?.url).toBe("https://example.test/v1/messages");
      expect(requests[0]?.apiKey).toBe("anthropic-test-key");

      const payload = requests[0]?.body as {
        system: string;
        messages: Array<{ role: string; content: string }>;
      };
      expect(payload.system).toContain("backend: fastify");
      expect(payload.messages.at(-1)?.content).toBe("Inspect the service boundaries");
    });
  });
});

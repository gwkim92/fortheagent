import { describe, expect, it } from "vitest";
import { routeHomeInput } from "../../src/app/intent-router.js";

describe("intent router", () => {
  it("routes setup intents", () => {
    expect(routeHomeInput("1")).toMatchObject({ kind: "setup" });
    expect(routeHomeInput("setup")).toMatchObject({ kind: "setup" });
    expect(routeHomeInput("guided")).toMatchObject({ kind: "setup" });
    expect(routeHomeInput("no llm")).toMatchObject({ kind: "setup" });
  });

  it("routes generic agent intents", () => {
    expect(routeHomeInput("2")).toMatchObject({ kind: "agent" });
    expect(routeHomeInput("agent")).toMatchObject({ kind: "agent" });
    expect(routeHomeInput("chat")).toMatchObject({ kind: "agent" });
  });

  it("routes direct provider intents as preferred providers and keeps trailing prompt text", () => {
    expect(routeHomeInput("codex review auth flow")).toEqual({
      kind: "agent",
      preferredProvider: "codex-local",
      prompt: "review auth flow"
    });
    expect(routeHomeInput("claude")).toEqual({
      kind: "agent",
      preferredProvider: "claude-local",
      prompt: null
    });
    expect(routeHomeInput("openai summarize")).toEqual({
      kind: "agent",
      preferredProvider: "openai-api",
      prompt: "summarize"
    });
    expect(routeHomeInput("anthropic")).toEqual({
      kind: "agent",
      preferredProvider: "anthropic-api",
      prompt: null
    });
    expect(routeHomeInput("oauth")).toEqual({
      kind: "agent",
      preferredProvider: "hosted-oauth",
      prompt: null
    });
  });

  it("treats arbitrary free text as a goal-first agent request", () => {
    expect(routeHomeInput("unknown")).toEqual({
      kind: "agent",
      preferredProvider: null,
      prompt: "unknown"
    });
  });
});

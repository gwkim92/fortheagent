import { describe, expect, it } from "vitest";
import { routeWorkflowRequest } from "../../src/app/workflow-registry.js";

describe("workflow registry", () => {
  it("routes setup intents", () => {
    expect(routeWorkflowRequest("1")).toMatchObject({ kind: "setup" });
    expect(routeWorkflowRequest("setup")).toMatchObject({ kind: "setup" });
    expect(routeWorkflowRequest("guided")).toMatchObject({ kind: "setup" });
    expect(routeWorkflowRequest("no llm")).toMatchObject({ kind: "setup" });
  });

  it("routes generic agent intents without forcing a provider", () => {
    expect(routeWorkflowRequest("2")).toEqual({
      kind: "agent",
      prompt: null,
      preferredProvider: null
    });
    expect(routeWorkflowRequest("review auth flow")).toEqual({
      kind: "agent",
      prompt: "review auth flow",
      preferredProvider: null
    });
    expect(routeWorkflowRequest("gd")).toEqual({
      kind: "agent",
      prompt: "gd",
      preferredProvider: null
    });
  });

  it("keeps provider hints as a preference instead of a separate mode", () => {
    expect(routeWorkflowRequest("codex review auth flow")).toEqual({
      kind: "agent",
      preferredProvider: "codex-local",
      prompt: "review auth flow"
    });
    expect(routeWorkflowRequest("claude")).toEqual({
      kind: "agent",
      preferredProvider: "claude-local",
      prompt: null
    });
  });
});

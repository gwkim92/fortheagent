import { describe, expect, it } from "vitest";
import {
  buildProviderWorkflowPrompt,
  classifyProviderWorkflow,
  routeBuiltInWorkflow
} from "../../src/app/workflow-router.js";

describe("workflow router", () => {
  it("routes doc generation aliases", () => {
    expect(routeBuiltInWorkflow("gd")).toEqual({ kind: "generate-docs" });
    expect(routeBuiltInWorkflow("generate docs")).toEqual({ kind: "generate-docs" });
    expect(routeBuiltInWorkflow("refresh docs")).toEqual({ kind: "generate-docs" });
  });

  it("routes repository explanation prompts", () => {
    expect(routeBuiltInWorkflow("explain this repository")).toEqual({
      kind: "explain-repository"
    });
    expect(routeBuiltInWorkflow("what kind of project is this")).toEqual({
      kind: "explain-repository"
    });
  });

  it("routes additional local workflows", () => {
    expect(routeBuiltInWorkflow("build a landing page")).toEqual({
      kind: "scope-guard"
    });
    expect(routeBuiltInWorkflow("architecture")).toEqual({
      kind: "architecture-brief"
    });
    expect(routeBuiltInWorkflow("next steps")).toEqual({
      kind: "next-steps"
    });
    expect(routeBuiltInWorkflow("review auth flow")).toEqual({
      kind: "review-repository"
    });
  });

  it("classifies provider-backed workflows and wraps them", () => {
    const workflow = classifyProviderWorkflow("expand architecture docs for auth and seo");

    expect(workflow).toEqual({
      kind: "documentation-planning",
      label: "documentation planning"
    });
    expect(
      buildProviderWorkflowPrompt(workflow, "expand architecture docs for auth and seo")
    ).toContain("forTheAgent workflow: documentation-planning");
  });

  it("classifies rules and skills drafting separately", () => {
    expect(classifyProviderWorkflow("suggest rules for auth-heavy reviews")).toEqual({
      kind: "rules-planning",
      label: "rules planning"
    });
    expect(classifyProviderWorkflow("suggest skills for a content-site repo")).toEqual({
      kind: "skills-planning",
      label: "skills planning"
    });
  });

  it("returns null for ordinary documentation prompts", () => {
    expect(routeBuiltInWorkflow("expand architecture docs for auth and seo")).toBeNull();
  });

  it("routes code-generation asks back to scope", () => {
    expect(routeBuiltInWorkflow("create dashboard widgets")).toEqual({
      kind: "scope-guard"
    });
    expect(
      buildProviderWorkflowPrompt(
        classifyProviderWorkflow("suggest rules for auth-heavy reviews"),
        "suggest rules for auth-heavy reviews"
      )
    ).toContain("forTheAgent workflow: rules-planning");
  });
});

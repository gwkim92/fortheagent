export type BuiltInWorkflowIntent =
  | {
      kind: "generate-docs";
    }
  | {
      kind: "explain-repository";
    }
  | {
      kind: "architecture-brief";
    }
  | {
      kind: "next-steps";
    }
  | {
      kind: "review-repository";
    }
  | {
      kind: "scope-guard";
    };

export type ProviderWorkflowIntent = {
  kind:
    | "repository-review"
    | "architecture-planning"
    | "documentation-planning"
    | "rules-planning"
    | "skills-planning"
    | "task-breakdown"
    | "general-chat";
  label: string;
};

function normalize(input: string): string {
  return input.trim().toLowerCase().replace(/\s+/g, " ");
}

export function routeBuiltInWorkflow(input: string): BuiltInWorkflowIntent | null {
  const normalized = normalize(input);

  if (!normalized) {
    return null;
  }

  if (
    normalized === "gd" ||
    normalized === "generate docs" ||
    normalized === "generate foundation docs" ||
    normalized === "refresh docs" ||
    normalized === "update docs" ||
    normalized === "regenerate docs"
  ) {
    return {
      kind: "generate-docs"
    };
  }

  if (
    normalized === "explain this repo" ||
    normalized === "explain this repository" ||
    normalized === "explain this codebase" ||
    normalized === "summarize this repo" ||
    normalized === "summarize this repository" ||
    normalized === "what is this repo" ||
    normalized === "what is this repository" ||
    normalized === "what kind of project is this"
  ) {
    return {
      kind: "explain-repository"
    };
  }

  if (
    normalized === "architecture" ||
    normalized === "architecture brief" ||
    normalized === "architecture plan" ||
    normalized === "design this repository" ||
    normalized === "design this repo" ||
    normalized === "how should i structure this" ||
    normalized === "how should this be structured"
  ) {
    return {
      kind: "architecture-brief"
    };
  }

  if (
    normalized === "what should i do next" ||
    normalized === "what next" ||
    normalized === "next steps" ||
    normalized === "task breakdown" ||
    normalized === "break this down" ||
    normalized === "implementation plan"
  ) {
    return {
      kind: "next-steps"
    };
  }

  if (
    normalized === "review this repository" ||
    normalized === "review this repo" ||
    normalized.startsWith("review ") ||
    normalized === "audit this repository" ||
    normalized === "audit this repo" ||
    normalized.startsWith("audit ") ||
    normalized.startsWith("check ")
  ) {
    return {
      kind: "review-repository"
    };
  }

  if (
    (normalized.startsWith("build ") ||
      normalized.startsWith("create ") ||
      normalized.startsWith("scaffold ") ||
      normalized.startsWith("implement ") ||
      normalized.startsWith("generate ")) &&
    (
      normalized.includes("page") ||
      normalized.includes("landing") ||
      normalized.includes("homepage") ||
      normalized.includes("component") ||
      normalized.includes("widget") ||
      normalized.includes("dashboard") ||
      normalized.includes("screen") ||
      normalized.includes("endpoint") ||
      normalized.includes("api") ||
      normalized.includes("app")
    )
  ) {
    return {
      kind: "scope-guard"
    };
  }

  return null;
}

export function classifyProviderWorkflow(input: string): ProviderWorkflowIntent {
  const normalized = normalize(input);

  if (
    normalized.includes("rule") ||
    normalized.includes("policy") ||
    normalized.includes("guardrail")
  ) {
    return {
      kind: "rules-planning",
      label: "rules planning"
    };
  }

  if (
    normalized.includes("skill") ||
    normalized.includes("playbook") ||
    normalized.includes("workflow")
  ) {
    return {
      kind: "skills-planning",
      label: "skills planning"
    };
  }

  if (
    normalized.includes("architecture") ||
    normalized.includes("design") ||
    normalized.includes("structure") ||
    normalized.includes("doc") ||
    normalized.includes("documentation") ||
    normalized.includes("manifest")
  ) {
    return {
      kind: "documentation-planning",
      label: "documentation planning"
    };
  }

  if (
    normalized.includes("breakdown") ||
    normalized.includes("task list") ||
    normalized.includes("implementation plan") ||
    normalized.includes("todo") ||
    normalized.includes("next steps")
  ) {
    return {
      kind: "task-breakdown",
      label: "task breakdown"
    };
  }

  if (
    normalized.includes("review") ||
    normalized.includes("audit") ||
    normalized.includes("bug") ||
    normalized.includes("issue")
  ) {
    return {
      kind: "repository-review",
      label: "repository review"
    };
  }

  return {
    kind: "general-chat",
    label: "general chat"
  };
}

export function buildProviderWorkflowPrompt(
  workflow: ProviderWorkflowIntent,
  userMessage: string
): string {
  const instructions =
    workflow.kind === "repository-review"
      ? [
          "Treat this as a code/repository review request.",
          "Focus on agent-facing documentation coverage, manifest alignment, and contract risks.",
          "Do not turn this into an application code review unless the user explicitly re-scopes the product."
        ]
      : workflow.kind === "documentation-planning"
        ? [
            "Treat this as a documentation planning request.",
            "Use the current repository manifest as a fixed constraint set.",
            "Expand or refine agent-facing docs, not application code."
          ]
        : workflow.kind === "rules-planning"
          ? [
              "Treat this as a rules-planning request.",
              "Propose repository rules, review rules, and guardrails that agents should follow.",
              "Stay within documentation and contract scope."
            ]
          : workflow.kind === "skills-planning"
            ? [
                "Treat this as a skills-planning request.",
                "Propose skills or workflow guidance the agent should have for this project.",
                "Stay within documentation and contract scope."
              ]
        : workflow.kind === "task-breakdown"
          ? [
              "Treat this as a task breakdown request.",
              "Return an ordered documentation and setup sequence with concrete next steps.",
              "Prefer changes to docs, rules, skills, and manifest-aligned guidance over code generation."
            ]
            : [
                "Treat this as a general repository-aware request.",
                "Use the repository context before inventing new assumptions.",
                "Do not generate application code unless the user explicitly re-scopes the product."
              ];

  return [
    `forTheAgent workflow: ${workflow.kind}`,
    ...instructions.map((line) => `- ${line}`),
    "",
    "Original user request:",
    userMessage
  ].join("\n");
}

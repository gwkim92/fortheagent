import type { SessionContext } from "./repository-context.js";
import { listUserWorkspaceEntries } from "./workspace-shape.js";
import { renderPanel } from "../app/chrome.js";

function describeStack(sessionContext: SessionContext): string {
  const frontend = sessionContext.manifest.frontend;
  const backend = sessionContext.manifest.backend;

  if (frontend && backend) {
    return `\`${frontend}\` + \`${backend}\``;
  }

  if (frontend) {
    return `\`${frontend}\``;
  }

  if (backend) {
    return `\`${backend}\``;
  }

  return "none";
}

export async function describeArchitectureStarter(
  sessionContext: SessionContext
): Promise<string> {
  const constraints = sessionContext.manifest.constraints.join(", ") || "none";

  return renderPanel({
    title: "Architecture documentation brief",
    subtitle: "Project-specific doc boundaries",
    lines: [
      { text: `system type: \`${sessionContext.manifest.systemType ?? "none"}\`` },
      { text: `architecture style: \`${sessionContext.manifest.architectureStyle ?? "none"}\`` },
      { text: `selected stack: ${describeStack(sessionContext)}` },
      { text: `active constraints: ${constraints}` },
      {
        text: "Recommended boundaries: Keep `.agent-foundation/manifest.json` as the source of truth.",
        tone: "subtle"
      },
      {
        text: "Recommended boundaries: Expand `docs/architecture/overview.md` only with repository decisions.",
        tone: "subtle"
      },
      {
        text: "Recommended boundaries: Keep frontend/backend/system docs aligned to selected profiles.",
        tone: "subtle"
      },
      { text: "Suggested next documentation steps: 1. Add project-specific architecture constraints." },
      { text: "Suggested next documentation steps: 2. Expand rule docs with review and coding guardrails." },
      { text: "Suggested next documentation steps: 3. Add skill references for expected workflows." },
      { text: "Use `gd` after architecture doc changes if generated files need refresh.", tone: "subtle" }
    ]
  });
}

export async function describeNextSteps(sessionContext: SessionContext): Promise<string> {
  const entries = await listUserWorkspaceEntries(sessionContext.cwd);
  const bootstrapOnly = entries.length === 0;

  if (bootstrapOnly) {
    return renderPanel({
      title: "Next steps for this repository",
      subtitle: "Bootstrap-only repository",
      lines: [
        { text: "1. Confirm that the current manifest selections match the real project." },
        { text: "2. Expand architecture docs with project-specific boundaries and decisions." },
        { text: "3. Add repository-specific rules and skills guidance for the agent." },
        { text: "4. Re-run `gd` after doc changes so the generated foundation stays aligned." },
        {
          text: "5. Use provider-backed help only for documentation drafting, not application code generation."
        }
      ]
    });
  }

  return renderPanel({
    title: "Next steps for this repository",
    subtitle: "Repository already has implementation areas",
    lines: [
      { text: `1. Review the existing top-level repository areas: ${entries.join(", ")}.` },
      { text: "2. Check whether the current docs still reflect the actual project shape." },
      { text: "3. Run `/doctor` and `/sync` after contract or template changes." },
      { text: "4. Prefer expanding docs, rules, and skills before asking for provider-backed drafting." }
    ]
  });
}

export async function reviewCurrentRepository(
  sessionContext: SessionContext,
  userRequest: string
): Promise<string> {
  const entries = await listUserWorkspaceEntries(sessionContext.cwd);
  const bootstrapOnly = entries.length === 0;

  if (bootstrapOnly) {
    return renderPanel({
      title: "Repository review",
      subtitle: `Requested review: ${userRequest}`,
      lines: [
        {
          text: "Findings: 1. The repository is still bootstrap-only; the current scope is the forTheAgent contract itself."
        },
        {
          text: "Findings: 2. Core docs are present, so the immediate risk is drift between manifest values and written guidance."
        },
        {
          text: `Findings: 3. Declared constraints (${sessionContext.manifest.constraints.join(", ") || "none"}) should be reflected in rules/docs, not code.`
        },
        {
          text: "Recommended next move: Expand architecture, rules, and skills docs before implementation teams start coding.",
          tone: "subtle"
        },
        {
          text: "Recommended next move: Use provider-backed help for doc drafting if the current guidance is still too generic.",
          tone: "subtle"
        }
      ]
    });
  }

  return renderPanel({
    title: "Repository review",
    subtitle: `Requested review: ${userRequest}`,
    lines: [
      { text: `Quick documentation findings: 1. Top-level implementation areas detected: ${entries.join(", ")}.` },
      {
        text: "Quick documentation findings: 2. The repository is no longer bootstrap-only, so docs should be checked against real boundaries."
      },
      {
        text: "Quick documentation findings: 3. forTheAgent can attach an AI provider for a deeper documentation and contract review when needed."
      }
    ]
  });
}

export async function describeCodeGenerationScopeGuard(
  sessionContext: SessionContext,
  userRequest: string
): Promise<string> {
  return renderPanel({
    title: "Scope clarification",
    subtitle: `Requested task: ${userRequest}`,
    lines: [
      { text: "forTheAgent does not scaffold application code as part of this product." },
      { text: "Its job is to install and maintain agent-facing assets such as:", tone: "subtle" },
      { text: "- `AGENTS.md`", tone: "subtle" },
      { text: "- rules docs", tone: "subtle" },
      { text: "- skills docs", tone: "subtle" },
      { text: "- architecture/system markdown", tone: "subtle" },
      { text: "- `.agent-foundation/manifest.json`", tone: "subtle" },
      { text: `What forTheAgent can do instead: update documentation for the selected ${describeStack(sessionContext)} stack.` },
      { text: "What forTheAgent can do instead: refresh architecture and system docs." },
      { text: "What forTheAgent can do instead: suggest repository rules and skills for the project." },
      { text: "What forTheAgent can do instead: review whether the current foundation docs match the manifest." }
    ]
  });
}

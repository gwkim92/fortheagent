import type { SessionContext } from "./repository-context.js";
import { listUserWorkspaceEntries } from "./workspace-shape.js";
import { renderPanel } from "../app/chrome.js";

function describeStack(sessionContext: SessionContext): string {
  const frontend = sessionContext.manifest.frontend;
  const backend = sessionContext.manifest.backend;

  if (frontend && backend) {
    return `frontend \`${frontend}\` and backend \`${backend}\``;
  }

  if (frontend) {
    return `frontend \`${frontend}\``;
  }

  if (backend) {
    return `backend \`${backend}\``;
  }

  return "no application stack yet";
}

export async function describeRepository(sessionContext: SessionContext): Promise<string> {
  const userFacingEntries = await listUserWorkspaceEntries(sessionContext.cwd);
  const topLevelSummary =
    userFacingEntries.length > 0
      ? `Additional top-level entries: ${userFacingEntries.slice(0, 6).join(", ")}`
      : "Current workspace is still bootstrap-only: no application directories outside the forTheAgent contract files were detected.";

  return renderPanel({
    title: "Repository summary",
    subtitle: "This is a resolved forTheAgent repository.",
    lines: [
      { text: `Project type: \`${sessionContext.manifest.systemType ?? "none"}\`` },
      { text: `Architecture style: \`${sessionContext.manifest.architectureStyle ?? "none"}\`` },
      { text: `Stack: ${describeStack(sessionContext)}` },
      { text: `Constraints: ${sessionContext.manifest.constraints.join(", ") || "none"}` },
      { text: topLevelSummary, tone: "subtle" },
      { text: "Key documents:", tone: "subtle" },
      ...sessionContext.documents.map((document) => ({
        text: `- ${document.path}`,
        tone: "subtle" as const
      }))
    ]
  });
}

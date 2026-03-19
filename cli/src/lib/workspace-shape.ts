import { readdir } from "node:fs/promises";

export async function listUserWorkspaceEntries(cwd: string): Promise<string[]> {
  const entries = await readdir(cwd, { withFileTypes: true });

  return entries
    .map((entry) => entry.name)
    .filter(
      (name) =>
        name !== ".agent-foundation" &&
        name !== ".agents" &&
        name !== ".claude" &&
        name !== ".cursor" &&
        name !== ".github" &&
        name !== "docs" &&
        name !== "AGENTS.md" &&
        name !== "CLAUDE.md" &&
        name !== "GEMINI.md"
    )
    .sort();
}

export async function isBootstrapOnlyWorkspace(cwd: string): Promise<boolean> {
  const entries = await listUserWorkspaceEntries(cwd);
  return entries.length === 0;
}

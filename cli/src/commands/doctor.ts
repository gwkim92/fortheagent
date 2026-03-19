import { access } from "node:fs/promises";
import path from "node:path";
import { readManifestState } from "../lib/current-selection.js";
import { runFoundationDoctor } from "../lib/foundation-engine.js";

const legacyBaseFiles = [
  "AGENTS.md",
  "GEMINI.md",
  ".agent-foundation/manifest.json",
  ".agent-foundation/profile-registry.json"
] as const;

function translateRepairCommand(command: string): string {
  return command.replace(/^agent-foundation\b/, "fortheagent-cli");
}

export async function runDoctor(options: {
  cwd: string;
}): Promise<{
  ok: boolean;
  errors: string[];
  warnings: string[];
  repairCommands: string[];
  repairCommand: string | null;
}> {
  const manifestState = await readManifestState(options.cwd);

  if (manifestState.legacy) {
    const errors: string[] = [];

    for (const requiredFile of legacyBaseFiles) {
      try {
        await access(path.join(options.cwd, requiredFile));
      } catch {
        errors.push(`Missing required file: ${requiredFile}`);
      }
    }

    return {
      ok: errors.length === 0,
      errors,
      warnings: [
        "Legacy forTheAgent manifest detected. Run `fortheagent-cli setup` or `fortheagent-cli` -> Guided Setup -> Sync to migrate to the canonical foundation contract."
      ],
      repairCommands: ["fortheagent-cli setup"],
      repairCommand: "fortheagent-cli setup"
    };
  }

  const result = await runFoundationDoctor(options);
  const repairCommands = result.repairCommands.map(translateRepairCommand);

  return {
    ...result,
    repairCommands,
    repairCommand: repairCommands[0] ?? null
  };
}

import { readManifest } from "../lib/current-selection.js";
import { promptForMenuSelection, type TerminalStreams } from "../lib/terminal.js";
import { runCreate } from "../commands/create.js";
import { runDiscover } from "../commands/discover.js";
import { runDoctor } from "../commands/doctor.js";
import { runSync } from "../commands/sync.js";
import type { PromptAnswerSet } from "../lib/prompt.js";
import { renderBrandTitle, renderKeyValueLines, renderNoticePanel, renderPanel } from "./chrome.js";

type GuidedSetupAction = "discover" | "sync" | "doctor";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function formatSelection(selection: {
  projectPhase?: string | null;
  frontend: string | null;
  backend: string | null;
  systemType: string | null;
  architectureStyle: string | null;
  constraints: string[];
  qualityProfiles?: string[];
  practiceProfiles?: string[];
}): string[] {
  return [
    `project phase: ${selection.projectPhase ?? "unset"}`,
    `frontend stack: ${selection.frontend ?? "unset"}`,
    `backend stack: ${selection.backend ?? "unset"}`,
    `project type: ${selection.systemType ?? "unset"}`,
    `architecture style: ${selection.architectureStyle ?? "unset"}`,
    `important concerns: ${selection.constraints.join(", ") || "none"}`,
    `quality profiles: ${selection.qualityProfiles?.join(", ") || "none"}`,
    `practice profiles: ${selection.practiceProfiles?.join(", ") || "none"}`
  ];
}

function formatRepairMessage(result: {
  ok: boolean;
  errors: string[];
  warnings: string[];
  repairCommands: string[];
}): string[] {
  const lines: string[] = [];

  if (result.ok) {
    lines.push("Repository health check completed.");
  } else {
    lines.push("Repository health check found issues.");
    lines.push(...result.errors);
  }

  for (const warning of result.warnings) {
    lines.push(`warning: ${warning}`);
  }

  for (const repairCommand of result.repairCommands) {
    lines.push(`next: ${repairCommand}`);
  }

  return lines;
}

export async function runGuidedSetup(options: {
  cwd: string;
  streams?: TerminalStreams;
  answerSet?: PromptAnswerSet | PromptAnswerSet[];
}): Promise<void> {
  const output = options.streams?.output ?? process.stdout;
  const manifest = await readManifest(options.cwd);
  const answerSet =
    options.answerSet ??
    (process.env.FORTHEAGENT_ANSWER_SET
      ? (JSON.parse(process.env.FORTHEAGENT_ANSWER_SET) as PromptAnswerSet | PromptAnswerSet[])
      : undefined);

  writeLine(
    output,
    renderPanel({
      title: renderBrandTitle("Guided Setup"),
      subtitle: "Prepare or repair the repository docs foundation",
      lines: renderKeyValueLines([
        ["Repository", options.cwd],
        ["Provider", "Not required"]
      ])
    })
  );
  writeLine(output);

  if (!manifest) {
    writeLine(
      output,
      renderNoticePanel({
        title: "Starting Setup",
        message: "No forTheAgent manifest found. Starting repository setup.",
        details: ["A docs foundation manifest and root projections will be generated."]
      })
    );
    const result = await runCreate({
      cwd: options.cwd,
      streams: options.streams,
      answerSet
    });
    writeLine(
      output,
      renderPanel({
        title: renderBrandTitle("Setup Complete"),
        subtitle: "Repository is now configured.",
        lines: formatSelection(result.manifest).map((line) => ({ text: line }))
      })
    );
    return;
  }

  if (manifest.status === "unresolved") {
    writeLine(
      output,
      renderNoticePanel({
        title: renderBrandTitle("Continuing Discovery"),
        message: "This repository still needs discovery. Continuing setup.",
        details: ["The current manifest is unresolved, so forTheAgent will refresh the selections."]
      })
    );
    const result = await runDiscover({
      cwd: options.cwd,
      streams: options.streams,
      answerSet
    });
    writeLine(
      output,
      renderPanel({
        title: renderBrandTitle("Discovery Complete"),
        subtitle: "Discovery completed.",
        lines: formatSelection(result.manifest).map((line) => ({ text: line }))
      })
    );
    return;
  }

  writeLine(
    output,
      renderNoticePanel({
        title: renderBrandTitle("Repository Ready"),
      message: "This repository is already configured.",
      details: ["Choose whether you want to re-answer project questions, rebuild the generated docs, or just run checks."]
    })
  );
  writeLine(output);

  const action = await promptForMenuSelection<GuidedSetupAction>({
    title: "What do you want to do?",
    streams: options.streams,
    fallbackPrompt: "What do you want to do next? ",
    options: [
      {
        label: "[1] Re-answer the project questions",
        value: "discover",
        keywords: ["1", "discover", "re-answer", "project questions"]
      },
      {
        label: "[2] Rebuild the generated docs",
        value: "sync",
        keywords: ["2", "sync", "rebuild generated docs", "generated docs"]
      },
      {
        label: "[3] Check whether the docs are healthy",
        value: "doctor",
        keywords: ["3", "doctor", "health", "healthy"]
      }
    ]
  });

  writeLine(output);

  if (action === "discover") {
    const result = await runDiscover({
      cwd: options.cwd,
      streams: options.streams,
      answerSet
    });

    writeLine(
      output,
      renderPanel({
        title: renderBrandTitle("Discovery Updated"),
        subtitle: "Discovery updated.",
        lines: formatSelection(result.manifest).map((line) => ({ text: line }))
      })
    );
    return;
  }

  if (action === "sync") {
    const result = await runSync({ cwd: options.cwd });
    writeLine(
      output,
      renderPanel({
        title: renderBrandTitle("Sync Complete"),
        subtitle: "Managed files synced.",
        lines: [
          {
            text: `updated: ${result.updated.join(", ") || "none"}`
          },
          {
            text: `skipped: ${result.skipped.join(", ") || "none"}`
          },
          {
            text: `conflicted: ${result.conflicted.join(", ") || "none"}`
          },
          {
            text: `pruned: ${result.pruned.join(", ") || "none"}`
          },
          ...(result.migratedLegacy
            ? [
                {
                  text: "legacy manifest migrated to the canonical foundation contract",
                  tone: "subtle" as const
                }
              ]
            : [])
        ]
      })
    );
    return;
  }

  const doctor = await runDoctor({ cwd: options.cwd });
  writeLine(
    output,
    renderPanel({
      title: renderBrandTitle("Doctor Result"),
      subtitle: doctor.ok ? "Repository health check completed." : "Repository health check found issues.",
      lines: formatRepairMessage(doctor).slice(1).map((line) => ({
        text: line,
        tone: line.startsWith("warning:") || line.startsWith("next:") ? "subtle" as const : "body" as const
      }))
    })
  );
}

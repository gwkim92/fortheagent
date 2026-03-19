import path from "node:path";
import { runGuidedSetup } from "./app/run-guided-setup.js";
import { runApp } from "./app/run-app.js";
import { runDoctor } from "./commands/doctor.js";
import { runDiscover } from "./commands/discover.js";
import { runHistory } from "./commands/history.js";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runSync } from "./commands/sync.js";
import { runWork } from "./commands/work.js";
import { TerminalAbortError, TerminalClosedError } from "./lib/abort.js";
import type { PromptAnswerSet } from "./lib/prompt.js";
import type { TerminalStreams } from "./lib/terminal.js";

type RunCliOptions = {
  argv?: string[];
  streams?: TerminalStreams;
  runAppImpl?: typeof runApp;
};

type CommandName = "init" | "sync" | "doctor" | "status" | "history" | "setup" | "work";
const launcherCommand = "fortheagent-cli";

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function parseCwdOption(argv: string[], fallback: string): { cwd: string; rest: string[] } {
  const rest: string[] = [];
  let cwd = fallback;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--cwd") {
      cwd = path.resolve(argv[index + 1] ?? cwd);
      index += 1;
      continue;
    }

    rest.push(token);
  }

  return {
    cwd,
    rest
  };
}

function readAnswerSetFromEnv(): PromptAnswerSet | PromptAnswerSet[] | undefined {
  const raw = process.env.FORTHEAGENT_ANSWER_SET;

  if (!raw) {
    return undefined;
  }

  return JSON.parse(raw) as PromptAnswerSet | PromptAnswerSet[];
}

function collectListValue(target: string[], raw: string | undefined): void {
  if (!raw) {
    return;
  }

  for (const value of raw.split(",").map((entry) => entry.trim()).filter(Boolean)) {
    if (!target.includes(value)) {
      target.push(value);
    }
  }
}

function parseInitAnswerSet(argv: string[]): PromptAnswerSet | undefined {
  const answerSet: PromptAnswerSet = {};
  const constraints: string[] = [];
  const qualityProfiles: string[] = [];
  const practiceProfiles: string[] = [];
  const targetUsers: string[] = [];
  const coreEntities: string[] = [];
  const criticalRisks: string[] = [];
  const deliveryPriorities: string[] = [];
  const currentPainPoints: string[] = [];
  const stabilityConstraints: string[] = [];

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    switch (token) {
      case "--project-phase":
        answerSet.projectPhase = next as PromptAnswerSet["projectPhase"];
        index += 1;
        break;
      case "--frontend":
        answerSet.frontend = next as PromptAnswerSet["frontend"];
        index += 1;
        break;
      case "--backend":
        answerSet.backend = next as PromptAnswerSet["backend"];
        index += 1;
        break;
      case "--system-type":
        answerSet.systemType = next as PromptAnswerSet["systemType"];
        index += 1;
        break;
      case "--architecture-style":
        answerSet.architectureStyle = next as PromptAnswerSet["architectureStyle"];
        index += 1;
        break;
      case "--constraint":
        collectListValue(constraints, next);
        index += 1;
        break;
      case "--quality-profile":
        collectListValue(qualityProfiles, next);
        index += 1;
        break;
      case "--practice-profile":
        collectListValue(practiceProfiles, next);
        index += 1;
        break;
      case "--primary-product":
        answerSet.primaryProduct = next ?? "";
        index += 1;
        break;
      case "--target-user":
        collectListValue(targetUsers, next);
        index += 1;
        break;
      case "--core-entity":
        collectListValue(coreEntities, next);
        index += 1;
        break;
      case "--critical-risk":
        collectListValue(criticalRisks, next);
        index += 1;
        break;
      case "--delivery-priority":
        collectListValue(deliveryPriorities, next);
        index += 1;
        break;
      case "--current-pain-point":
        collectListValue(currentPainPoints, next);
        index += 1;
        break;
      case "--stability-constraint":
        collectListValue(stabilityConstraints, next);
        index += 1;
        break;
      default:
        break;
    }
  }

  if (constraints.length > 0) {
    answerSet.constraints = constraints;
  }
  if (qualityProfiles.length > 0) {
    answerSet.qualityProfiles = qualityProfiles;
  }
  if (practiceProfiles.length > 0) {
    answerSet.practiceProfiles = practiceProfiles;
  }
  if (targetUsers.length > 0) {
    answerSet.targetUsers = targetUsers;
  }
  if (coreEntities.length > 0) {
    answerSet.coreEntities = coreEntities;
  }
  if (criticalRisks.length > 0) {
    answerSet.criticalRisks = criticalRisks;
  }
  if (deliveryPriorities.length > 0) {
    answerSet.deliveryPriorities = deliveryPriorities;
  }
  if (currentPainPoints.length > 0) {
    answerSet.currentPainPoints = currentPainPoints;
  }
  if (stabilityConstraints.length > 0) {
    answerSet.stabilityConstraints = stabilityConstraints;
  }

  return Object.keys(answerSet).length > 0 ? answerSet : undefined;
}

function parseWorkArgs(argv: string[]): {
  mode?: "design" | "implementation" | "maintenance";
  activeWorkItem?: string;
  archiveActive?: boolean;
} {
  const options: {
    mode?: "design" | "implementation" | "maintenance";
    activeWorkItem?: string;
    archiveActive?: boolean;
  } = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (
      token === "--mode" &&
      (next === "design" || next === "implementation" || next === "maintenance")
    ) {
      options.mode = next;
      index += 1;
      continue;
    }

    if (token === "--active-work-item" && next) {
      options.activeWorkItem = next;
      index += 1;
      continue;
    }

    if (token === "--archive-active") {
      options.archiveActive = true;
    }
  }

  return options;
}

function isKnownCommand(token: string | undefined): token is CommandName {
  return token === "init" || token === "sync" || token === "doctor" || token === "status" || token === "history" || token === "setup" || token === "work";
}

function printSubcommandHelp(output: NodeJS.WritableStream, command: CommandName): void {
  switch (command) {
    case "init":
      writeLine(output, `Usage: ${launcherCommand} init [--mode deferred] [--cwd <path>] [selection flags]`);
      writeLine(output);
      writeLine(output, "Selection flags:");
      writeLine(output, "  --project-phase <greenfield|existing>");
      writeLine(output, "  --frontend <profile>");
      writeLine(output, "  --backend <profile>");
      writeLine(output, "  --system-type <profile>");
      writeLine(output, "  --architecture-style <profile>");
      writeLine(output, "  --constraint <name>");
      writeLine(output, "  --quality-profile <name>");
      writeLine(output, "  --practice-profile <name>");
      return;
    case "sync":
      writeLine(output, `Usage: ${launcherCommand} sync [--cwd <path>] [--dry-run] [--repair] [--prune]`);
      return;
    case "doctor":
      writeLine(output, `Usage: ${launcherCommand} doctor [--cwd <path>]`);
      return;
    case "status":
      writeLine(output, `Usage: ${launcherCommand} status [--cwd <path>]`);
      return;
    case "history":
      writeLine(output, `Usage: ${launcherCommand} history [--cwd <path>]`);
      return;
    case "work":
      writeLine(output, `Usage: ${launcherCommand} work [--cwd <path>] [--mode <design|implementation|maintenance>] [--active-work-item <slug-or-path>] [--archive-active]`);
      return;
    case "setup":
      writeLine(output, `Usage: ${launcherCommand} setup [--cwd <path>]`);
      return;
  }
}

function printDoctorResult(
  output: NodeJS.WritableStream,
  result: Awaited<ReturnType<typeof runDoctor>>
): number {
  for (const warning of result.warnings) {
    writeLine(output, `Warning: ${warning}`);
  }

  for (const error of result.errors) {
    writeLine(output, error);
  }

  for (const repairCommand of result.repairCommands) {
    writeLine(output, `Repair with: ${repairCommand}`);
  }

  if (result.ok) {
    writeLine(output, "foundation repository is healthy");
    return 0;
  }

  return 1;
}

async function runDirectCommand(
  command: CommandName,
  argv: string[],
  streams?: TerminalStreams
): Promise<number> {
  const output = streams?.output ?? process.stdout;
  const { cwd, rest } = parseCwdOption(argv, process.cwd());

  if (rest.includes("--help") || rest.includes("-h")) {
    printSubcommandHelp(output, command);
    return 0;
  }

  switch (command) {
    case "setup":
      await runGuidedSetup({ cwd, streams });
      return 0;
    case "init": {
      const mode = rest.includes("--mode") && rest.includes("deferred") ? "deferred" : "interactive";
      const answerSet = parseInitAnswerSet(rest) ?? readAnswerSetFromEnv();
      const result =
        mode === "deferred"
          ? await runInit({ cwd, mode: "deferred" })
          : await runDiscover({ cwd, streams, answerSet });
      writeLine(output, `initialized ${result.updated.length} foundation files`);
      return printDoctorResult(output, await runDoctor({ cwd }));
    }
    case "sync": {
      const result = await runSync({
        cwd,
        dryRun: rest.includes("--dry-run"),
        repair: rest.includes("--repair"),
        prune: rest.includes("--prune")
      });
      writeLine(output, `updated: ${result.updated.join(", ") || "none"}`);
      writeLine(output, `skipped: ${result.skipped.join(", ") || "none"}`);
      writeLine(output, `conflicted: ${result.conflicted.join(", ") || "none"}`);
      writeLine(output, `pruned: ${result.pruned.join(", ") || "none"}`);
      if (result.migratedLegacy) {
        writeLine(output, "legacy manifest migrated to the canonical foundation contract");
      }
      return 0;
    }
    case "doctor":
      return printDoctorResult(output, await runDoctor({ cwd }));
    case "status": {
      const result = await runStatus({ cwd });
      if (!result.ok) {
        writeLine(output, result.reason);
        return 1;
      }
      writeLine(output, `status: ${result.status}`);
      writeLine(output, `readiness: ${result.readiness}`);
      writeLine(output, `frontend: ${result.frontend ?? "none"}`);
      writeLine(output, `backend: ${result.backend ?? "none"}`);
      writeLine(output, `systemType: ${result.systemType ?? "none"}`);
      writeLine(output, `architectureStyle: ${result.architectureStyle ?? "none"}`);
      writeLine(output, `constraints: ${result.constraints.join(", ") || "none"}`);
      writeLine(output, `workflowMode: ${result.workflowMode}`);
      writeLine(output, `activeWorkItem: ${result.activeWorkItem ?? "none"}`);
      writeLine(output, `lastResolvedAt: ${result.lastResolvedAt ?? "none"}`);
      return 0;
    }
    case "history": {
      const result = await runHistory({ cwd });
      if (!result.ok) {
        writeLine(output, result.reason);
        return 1;
      }
      writeLine(output, `status: ${result.status}`);
      writeLine(output, `workflowMode: ${result.workflowMode}`);
      writeLine(output, `activeWorkItem: ${result.activeWorkItem ?? "none"}`);
      writeLine(output, `archivedCount: ${result.archivedCount}`);
      for (const entry of result.entries) {
        const handoffLabel = entry.handoffPresent
          ? entry.handoffPath
          : `missing (${entry.handoffPath})`;
        writeLine(
          output,
          `${entry.state}: ${entry.workItemTitle} | ${entry.workItemPath} | handoff: ${handoffLabel}`
        );
        if (entry.completionSummary) {
          writeLine(output, `summary: ${entry.completionSummary}`);
        }
      }
      return 0;
    }
    case "work": {
      const workOptions = parseWorkArgs(rest);
      const result = await runWork({
        cwd,
        mode: workOptions.mode,
        activeWorkItem: workOptions.activeWorkItem,
        archiveActive: workOptions.archiveActive
      });
      writeLine(output, `updated: ${result.updated.join(", ") || "none"}`);
      if (result.archived) {
        writeLine(output, `archived: ${result.archived}`);
      }
      writeLine(output, `workflowMode: ${result.manifest.workflowState.mode}`);
      writeLine(output, `activeWorkItem: ${result.manifest.workflowState.activeWorkItem ?? "none"}`);
      return 0;
    }
  }
}

export async function runCli(options: RunCliOptions = {}): Promise<number> {
  const output = options.streams?.output ?? process.stdout;
  const runAppImpl = options.runAppImpl ?? runApp;
  const argv = options.argv ?? process.argv.slice(2);
  const command = argv[0];

  try {
    if (isKnownCommand(command)) {
      return await runDirectCommand(command, argv.slice(1), options.streams);
    }

    return await runAppImpl({
      argv,
      streams: options.streams ?? {
        input: process.stdin,
        output
      }
    });
  } catch (error) {
    if (error instanceof TerminalAbortError || error instanceof TerminalClosedError) {
      output.write("\nCancelled.\n");
      return 130;
    }

    throw error;
  }
}

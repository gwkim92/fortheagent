#!/usr/bin/env node

import path from "node:path";
import { runDoctor } from "./commands/doctor.js";
import { runHistory } from "./commands/history.js";
import { runInit } from "./commands/init.js";
import { runStatus } from "./commands/status.js";
import { runSync } from "./commands/sync.js";
import { runWork } from "./commands/work.js";
import { writeBrandBanner, writeBrandLead, writeStatusBlock } from "./lib/chrome.js";
import { readManifest, manifestToSelectionDefaults } from "./lib/current-selection.js";
import { createSession, type PromptAnswerSet } from "./lib/prompt.js";
import { scanRepository } from "./lib/repo-scan.js";
import type { SelectionInput } from "./lib/selection.js";
import { runInitTui } from "./tui/app.js";

function printHelp(): void {
  writeBrandBanner(process.stdout, "command line foundation", [
    "Bootstrap agent-ready docs and guardrails for design kickoff."
  ]);
  console.log("Usage: fortheagent <command>");
  console.log("");
  console.log("Commands:");
  console.log("  init    bootstrap current repository (interactive by default)");
  console.log("  sync");
  console.log("  doctor");
  console.log("  status");
  console.log("  history");
  console.log("  work    update workflow mode and active work item");
  console.log("");
  console.log("Common:");
  console.log("  fortheagent init");
  console.log("  fortheagent init --mode deferred");
  console.log("  fortheagent init --project-phase greenfield --frontend next --backend nest");
  console.log("  fortheagent status");
  console.log("  fortheagent history");
  console.log("  fortheagent work --mode implementation --active-work-item 0002-auth-boundary");
  console.log("  fortheagent work --archive-active --active-work-item 0003-auth-rollout");
  console.log("  fortheagent init --plain");
  console.log("  fortheagent doctor");
}

type CliOptions = {
  cwd: string;
  mode?: "interactive" | "deferred";
  projectPhase?: "greenfield" | "existing";
  frontend?: string;
  backend?: string;
  systemType?: string;
  architectureStyle?: string;
  constraints: string[];
  qualityProfiles: string[];
  practiceProfiles: string[];
  primaryProduct?: string;
  targetUsers: string[];
  coreEntities: string[];
  criticalRisks: string[];
  deliveryPriorities: string[];
  currentPainPoints: string[];
  stabilityConstraints: string[];
  plain: boolean;
  dryRun: boolean;
  repair: boolean;
  prune: boolean;
  answerSet?: PromptAnswerSet | PromptAnswerSet[];
};

type WorkCliOptions = {
  cwd: string;
  mode?: "design" | "implementation" | "maintenance";
  activeWorkItem?: string;
  archiveActive?: boolean;
};

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

function parseOptions(argv: string[]): CliOptions {
  const options: CliOptions = {
    cwd: process.cwd(),
    constraints: [],
    qualityProfiles: [],
    practiceProfiles: [],
    targetUsers: [],
    coreEntities: [],
    criticalRisks: [],
    deliveryPriorities: [],
    currentPainPoints: [],
    stabilityConstraints: [],
    plain: false,
    dryRun: false,
    repair: false,
    prune: false
  };

  if (process.env.AGENT_FOUNDATION_ANSWER_SET) {
    options.answerSet = JSON.parse(process.env.AGENT_FOUNDATION_ANSWER_SET) as
      | PromptAnswerSet
      | PromptAnswerSet[];
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }

    if (token === "--mode" && (next === "interactive" || next === "deferred")) {
      options.mode = next;
      index += 1;
      continue;
    }

    if (token === "--project-phase" && (next === "greenfield" || next === "existing")) {
      options.projectPhase = next;
      index += 1;
      continue;
    }

    if (token === "--frontend" && next) {
      options.frontend = next;
      index += 1;
      continue;
    }

    if (token === "--backend" && next) {
      options.backend = next;
      index += 1;
      continue;
    }

    if (token === "--system-type" && next) {
      options.systemType = next;
      index += 1;
      continue;
    }

    if (token === "--architecture-style" && next) {
      options.architectureStyle = next;
      index += 1;
      continue;
    }

    if (token === "--constraint" && next) {
      options.constraints.push(next);
      index += 1;
      continue;
    }

    if (token === "--quality-profile" && next) {
      options.qualityProfiles.push(next);
      index += 1;
      continue;
    }

    if (token === "--practice-profile" && next) {
      options.practiceProfiles.push(next);
      index += 1;
      continue;
    }

    if (token === "--primary-product" && next) {
      options.primaryProduct = next;
      index += 1;
      continue;
    }

    if (token === "--target-user") {
      collectListValue(options.targetUsers, next);
      index += 1;
      continue;
    }

    if (token === "--core-entity") {
      collectListValue(options.coreEntities, next);
      index += 1;
      continue;
    }

    if (token === "--critical-risk") {
      collectListValue(options.criticalRisks, next);
      index += 1;
      continue;
    }

    if (token === "--delivery-priority") {
      collectListValue(options.deliveryPriorities, next);
      index += 1;
      continue;
    }

    if (token === "--current-pain-point") {
      collectListValue(options.currentPainPoints, next);
      index += 1;
      continue;
    }

    if (token === "--stability-constraint") {
      collectListValue(options.stabilityConstraints, next);
      index += 1;
      continue;
    }

    if (token === "--plain") {
      options.plain = true;
      continue;
    }

    if (token === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (token === "--repair") {
      options.repair = true;
      continue;
    }

    if (token === "--prune") {
      options.prune = true;
      continue;
    }
  }

  return options;
}

function parseWorkOptions(argv: string[]): WorkCliOptions {
  const options: WorkCliOptions = {
    cwd: process.cwd()
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = argv[index + 1];

    if (token === "--cwd" && next) {
      options.cwd = path.resolve(next);
      index += 1;
      continue;
    }

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

export function shouldUseTuiForInit(
  options: Pick<CliOptions, "answerSet" | "plain" | "mode" | "frontend" | "backend">,
  io: {
    stdinIsTTY: boolean;
    stdoutIsTTY: boolean;
  }
): boolean {
  const shouldRunInteractive =
    options.mode === "interactive" ||
    (!options.mode && (!options.frontend || !options.backend));

  return Boolean(
    shouldRunInteractive &&
      options.mode !== "deferred" &&
      !options.answerSet &&
      !options.plain &&
      io.stdinIsTTY &&
      io.stdoutIsTTY
  );
}

function mergeSelectionDefaults(
  manifestDefaults: Partial<SelectionInput> | undefined,
  options: CliOptions
): Partial<SelectionInput> | undefined {
  const merged: Partial<SelectionInput> = {
    ...manifestDefaults
  };

  if (options.frontend) {
    merged.frontend = options.frontend;
  }

  if (options.projectPhase) {
    merged.projectPhase = options.projectPhase;
  }

  if (options.backend) {
    merged.backend = options.backend;
  }

  if (options.systemType) {
    merged.systemType = options.systemType;
  }

  if (options.architectureStyle) {
    merged.architectureStyle = options.architectureStyle;
  }

  if (options.constraints.length > 0) {
    merged.constraints = [...new Set(options.constraints)].sort();
  }

  if (options.qualityProfiles.length > 0) {
    merged.qualityProfiles = [...new Set(options.qualityProfiles)].sort();
  }

  if (options.practiceProfiles.length > 0) {
    merged.practiceProfiles = [...new Set(options.practiceProfiles)].sort();
  }

  if (options.primaryProduct) {
    merged.primaryProduct = options.primaryProduct;
  }

  if (options.targetUsers.length > 0) {
    merged.targetUsers = [...new Set(options.targetUsers)].sort();
  }

  if (options.coreEntities.length > 0) {
    merged.coreEntities = [...new Set(options.coreEntities)].sort();
  }

  if (options.criticalRisks.length > 0) {
    merged.criticalRisks = [...new Set(options.criticalRisks)].sort();
  }

  if (options.deliveryPriorities.length > 0) {
    merged.deliveryPriorities = [...new Set(options.deliveryPriorities)].sort();
  }

  if (options.currentPainPoints.length > 0) {
    merged.currentPainPoints = [...new Set(options.currentPainPoints)].sort();
  }

  if (options.stabilityConstraints.length > 0) {
    merged.stabilityConstraints = [...new Set(options.stabilityConstraints)].sort();
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function printDoctorResult(result: Awaited<ReturnType<typeof runDoctor>>): number {
  for (const warning of result.warnings) {
    console.warn(`Warning: ${warning}`);
  }

  if (!result.ok) {
    for (const error of result.errors) {
      console.error(error);
    }
    for (const repairCommand of result.repairCommands) {
      console.error(`Repair with: ${repairCommand}`);
    }
    return 1;
  }

  writeStatusBlock(process.stdout, "success", "foundation repository is healthy");
  return 0;
}

export async function runCli(argv = process.argv.slice(2)): Promise<number> {
  try {
    const [command, ...rest] = argv;

    if (!command || command === "--help" || command === "-h") {
      printHelp();
      return 0;
    }

    const options = parseOptions(rest);

    switch (command) {
      case "init": {
        const shouldRunInteractive =
          options.mode === "interactive" ||
          (!options.mode && (!options.frontend || !options.backend));
        const manifest = shouldRunInteractive ? await readManifest(options.cwd) : null;
        const scan = shouldRunInteractive ? await scanRepository(options.cwd) : null;
        const defaults = shouldRunInteractive
          ? mergeSelectionDefaults(
              manifestToSelectionDefaults(manifest),
              options
            )
          : undefined;

        if (
          scan &&
          shouldUseTuiForInit(options, {
            stdinIsTTY: Boolean(process.stdin.isTTY),
            stdoutIsTTY: Boolean(process.stdout.isTTY)
          })
        ) {
          return await runInitTui({
            cwd: options.cwd,
            scan,
            defaults
          });
        }

        const result = shouldRunInteractive
          ? await (async () => {
              const session = createSession({
                answerSet: options.answerSet,
                scan: scan ?? undefined,
                defaults
              });
              const selection = await session.run();

              return await runInit({
                cwd: options.cwd,
                mode: "interactive",
                projectPhase: selection.projectPhase,
                frontend: selection.frontend ?? undefined,
                backend: selection.backend ?? undefined,
                systemType: selection.systemType ?? undefined,
                architectureStyle: selection.architectureStyle ?? undefined,
                constraints: selection.constraints,
                qualityProfiles: selection.qualityProfiles,
                practiceProfiles: selection.practiceProfiles,
                projectContext: {
                  primaryProduct: selection.primaryProduct,
                  targetUsers: selection.targetUsers,
                  coreEntities: selection.coreEntities,
                  criticalRisks: selection.criticalRisks,
                  deliveryPriorities: selection.deliveryPriorities,
                  currentPainPoints: selection.currentPainPoints,
                  stabilityConstraints: selection.stabilityConstraints
                }
              });
            })()
            : await runInit({
              cwd: options.cwd,
              mode: options.mode === "deferred" ? "deferred" : undefined,
              projectPhase: options.projectPhase,
              frontend: options.frontend,
              backend: options.backend,
              systemType: options.systemType,
              architectureStyle: options.architectureStyle,
              constraints: options.constraints,
              qualityProfiles: options.qualityProfiles,
              practiceProfiles: options.practiceProfiles,
              projectContext: {
                primaryProduct: options.primaryProduct,
                targetUsers: options.targetUsers,
                coreEntities: options.coreEntities,
                criticalRisks: options.criticalRisks,
                deliveryPriorities: options.deliveryPriorities,
                currentPainPoints: options.currentPainPoints,
                stabilityConstraints: options.stabilityConstraints
              }
            });
        writeBrandLead(process.stdout, "init", "foundation files written and validated");
        console.log(`initialized ${result.updated.length} foundation files`);
        const doctorResult = await runDoctor({ cwd: options.cwd });
        const doctorStatus = printDoctorResult(doctorResult);
        if (doctorStatus !== 0) {
          return doctorStatus;
        }
        console.log("next steps:");
        console.log("  codex  -> read AGENTS.md then .agent-foundation/handoffs/current.md");
        console.log("  claude -> read CLAUDE.md then .agent-foundation/handoffs/current.md");
        console.log("  gemini -> read GEMINI.md then .agent-foundation/handoffs/current.md");
        return 0;
      }
      case "sync": {
        const result = await runSync({
          cwd: options.cwd,
          dryRun: options.dryRun,
          repair: options.repair,
          prune: options.prune
        });
        writeBrandLead(process.stdout, "sync", "restore managed files and overlays");
        console.log(`updated: ${result.updated.join(", ") || "none"}`);
        console.log(`pruned: ${result.pruned.join(", ") || "none"}`);
        console.log(`skipped: ${result.skipped.join(", ") || "none"}`);
        console.log(`conflicted: ${result.conflicted.join(", ") || "none"}`);
        return 0;
      }
      case "doctor": {
        writeBrandLead(process.stdout, "doctor", "validate managed docs, rules, skills, and projections");
        const result = await runDoctor({ cwd: options.cwd });
        return printDoctorResult(result);
      }
      case "status": {
        writeBrandLead(process.stdout, "status", "show current foundation and workflow state");
        const result = await runStatus({ cwd: options.cwd });

        if (!result.ok) {
          console.error(result.reason);
          return 1;
        }

        console.log(`status: ${result.status}`);
        console.log(`readiness: ${result.readiness}`);
        console.log(`frontend: ${result.frontend ?? "none"}`);
        console.log(`backend: ${result.backend ?? "none"}`);
        console.log(`systemType: ${result.systemType ?? "none"}`);
        console.log(`architectureStyle: ${result.architectureStyle ?? "none"}`);
        console.log(`constraints: ${result.constraints.join(", ") || "none"}`);
        console.log(`workflowMode: ${result.workflowMode}`);
        console.log(`activeWorkItem: ${result.activeWorkItem ?? "none"}`);
        console.log(`lastResolvedAt: ${result.lastResolvedAt ?? "none"}`);
        return 0;
      }
      case "history": {
        writeBrandLead(process.stdout, "history", "show active work and archived handoff timeline");
        const result = await runHistory({ cwd: options.cwd });

        if (!result.ok) {
          console.error(result.reason);
          return 1;
        }

        console.log(`status: ${result.status}`);
        console.log(`workflowMode: ${result.workflowMode}`);
        console.log(`activeWorkItem: ${result.activeWorkItem ?? "none"}`);
        console.log(`archivedCount: ${result.archivedCount}`);

        for (const entry of result.entries) {
          const handoffLabel = entry.handoffPresent
            ? entry.handoffPath
            : `missing (${entry.handoffPath})`;
          console.log(
            `${entry.state}: ${entry.workItemTitle} | ${entry.workItemPath} | handoff: ${handoffLabel}`
          );
          if (entry.completionSummary) {
            console.log(`summary: ${entry.completionSummary}`);
          }
        }

        return 0;
      }
      case "work": {
        const workOptions = parseWorkOptions(rest);
        writeBrandLead(process.stdout, "work", "update workflow mode and active handoff target");
        const result = await runWork({
          cwd: workOptions.cwd,
          mode: workOptions.mode,
          activeWorkItem: workOptions.activeWorkItem,
          archiveActive: workOptions.archiveActive
        });
        console.log(`updated: ${result.updated.join(", ") || "none"}`);
        if (result.archived) {
          console.log(`archived: ${result.archived}`);
        }
        console.log(`workflowMode: ${result.manifest.workflowState.mode}`);
        console.log(`activeWorkItem: ${result.manifest.workflowState.activeWorkItem ?? "none"}`);
        return 0;
      }
      default: {
        printHelp();
        return 1;
      }
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

const exitCode = await runCli();
process.exitCode = exitCode;

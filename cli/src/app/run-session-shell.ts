import { buildSessionContext, type SessionContext } from "../lib/repository-context.js";
import { createSessionHistory, type SessionMessage } from "../lib/session.js";
import { createQuestionSession, type TerminalStreams } from "../lib/terminal.js";
import { TerminalClosedError } from "../lib/abort.js";
import {
  buildProviderWorkflowPrompt,
  classifyProviderWorkflow,
  routeBuiltInWorkflow
} from "./workflow-router.js";
import { runBuiltInWorkflow } from "./run-built-in-workflow.js";
import { runDoctor } from "../commands/doctor.js";
import { runHistory } from "../commands/history.js";
import { runStatus } from "../commands/status.js";
import { runSync } from "../commands/sync.js";
import { runWork } from "../commands/work.js";
import { runProviders } from "../commands/providers.js";
import { getProviderAdapter } from "../providers/index.js";
import type { ProviderId, ProviderTurnEvent } from "../providers/types.js";
import { runGuidedSetup } from "./run-guided-setup.js";
import {
  ensureProviderConfiguration,
  formatProviderLabel,
  resolveProviderSelection
} from "./provider-support.js";
import {
  getProviderAccent,
  looksLikePanel,
  renderBrandTitle,
  renderAssistantBlock,
  renderEventLine,
  renderKeyValueLines,
  renderNoticePanel,
  renderPanel,
  renderPromptLabel,
  renderProviderName
} from "./chrome.js";

type SessionShellOptions = {
  cwd: string;
  provider?: ProviderId | null;
  sessionContext: SessionContext;
  initialMessage?: string | null;
  streams?: TerminalStreams;
};

function writeLine(output: NodeJS.WritableStream, line = ""): void {
  output.write(`${line}\n`);
}

function renderHelp(): string {
  return renderPanel({
    title: renderBrandTitle("Session Help"),
    subtitle: "Slash commands stay inside forTheAgent",
    lines: [
      { text: "/help       Show session commands" },
      { text: "/provider   Switch provider and reset conversation" },
      { text: "/status     Show repository selection state" },
      { text: "/history    Show active work and archived handoff timeline" },
      { text: "/doctor     Run repository health checks" },
      { text: "/sync       Sync managed files" },
      { text: "/work       Update workflow mode or active work item" },
      { text: "/work done <next>   Archive current work and promote the next item", tone: "subtle" },
      { text: "/setup      Re-enter Guided Setup and reload context" },
      { text: "/clear      Clear conversation history" },
      { text: "/exit       Leave the session" },
      { text: "Built-ins   gd · explain this repository · architecture · next steps · review", tone: "subtle" },
      { text: "Fallback    Anything else becomes a forTheAgent task.", tone: "subtle" },
      { text: "Scope       Application code generation stays out of scope.", tone: "subtle" }
    ]
  });
}

function renderStatus(result: Awaited<ReturnType<typeof runStatus>>): string {
  if (!result.ok) {
    return renderPanel({
      title: renderBrandTitle("Repository Status"),
      subtitle: "Selection state",
      lines: [{ text: result.reason }]
    });
  }

  return renderPanel({
    title: renderBrandTitle("Repository Status"),
    subtitle: "Selection state",
    lines: renderKeyValueLines([
      ["status", result.status],
      ["readiness", result.readiness],
      ["frontend", result.frontend ?? "none"],
      ["backend", result.backend ?? "none"],
      ["systemType", result.systemType ?? "none"],
      ["architecture", result.architectureStyle ?? "none"],
      ["constraints", result.constraints.join(", ") || "none"],
      ["workflowMode", result.workflowMode],
      ["activeWorkItem", result.activeWorkItem ?? "none"],
      ["lastResolved", result.lastResolvedAt ?? "n/a"]
    ])
  });
}

function renderDoctor(result: Awaited<ReturnType<typeof runDoctor>>): string {
  const lines: Array<{ text: string; tone?: "body" | "subtle" }> = [
    { text: result.ok ? "Repository health: ok" : "Repository health: issues found" }
  ];

  for (const error of result.errors) {
    lines.push({ text: `error: ${error}` });
  }

  for (const warning of result.warnings) {
    lines.push({ text: `warning: ${warning}`, tone: "subtle" });
  }

  for (const repairCommand of result.repairCommands) {
    lines.push({ text: `next: ${repairCommand}`, tone: "subtle" });
  }

  return renderPanel({
    title: renderBrandTitle("Doctor"),
    subtitle: "Repository health checks",
    lines
  });
}

function renderHistory(result: Awaited<ReturnType<typeof runHistory>>): string {
  if (!result.ok) {
    return renderPanel({
      title: renderBrandTitle("History"),
      subtitle: "Workflow timeline",
      lines: [{ text: result.reason }]
    });
  }

  const lines: Array<{ text: string; tone?: "body" | "subtle" }> = [
    { text: `status: ${result.status}` },
    { text: `workflowMode: ${result.workflowMode}` },
    { text: `activeWorkItem: ${result.activeWorkItem ?? "none"}` },
    { text: `archivedCount: ${result.archivedCount}` }
  ];

  for (const entry of result.entries) {
    lines.push({
      text: `${entry.state}: ${entry.workItemTitle} | ${entry.workItemPath}`
    });
    if (entry.completionSummary) {
      lines.push({
        text: `summary: ${entry.completionSummary}`,
        tone: "subtle"
      });
    }
    lines.push({
      text: `handoff: ${entry.handoffPresent ? entry.handoffPath : `missing (${entry.handoffPath})`}`,
      tone: "subtle"
    });
  }

  return renderPanel({
    title: renderBrandTitle("History"),
    subtitle: "Workflow timeline",
    lines
  });
}

function renderSync(result: Awaited<ReturnType<typeof runSync>>): string {
  const lines: Array<{ text: string; tone?: "body" | "subtle" }> = [
    { text: `updated: ${result.updated.join(", ") || "none"}` },
    { text: `skipped: ${result.skipped.join(", ") || "none"}` },
    { text: `conflicted: ${result.conflicted.join(", ") || "none"}` },
    { text: `pruned: ${result.pruned.join(", ") || "none"}` }
  ];

  if (result.migratedLegacy) {
    lines.push({
      text: "legacy manifest migrated to the canonical foundation contract",
      tone: "subtle"
    });
  }

  return renderPanel({
    title: renderBrandTitle("Sync"),
    subtitle: "Managed file reconciliation",
    lines
  });
}

function renderWork(result: Awaited<ReturnType<typeof runWork>>): string {
  const lines: Array<{ text: string; tone?: "body" | "subtle" }> = [
    { text: `updated: ${result.updated.join(", ") || "none"}` }
  ];

  if (result.archived) {
    lines.push({ text: `archived: ${result.archived}` });
  }

  lines.push({ text: `workflowMode: ${result.manifest.workflowState.mode}` });
  lines.push({
    text: `activeWorkItem: ${result.manifest.workflowState.activeWorkItem ?? "none"}`
  });

  return renderPanel({
    title: renderBrandTitle("Work"),
    subtitle: "Workflow state updated",
    lines
  });
}

function parseSessionCommand(input: string): {
  command:
    | "help"
    | "provider"
    | "status"
    | "history"
    | "doctor"
    | "sync"
    | "work"
    | "setup"
    | "clear"
    | "exit";
  argument: string | null;
} | null {
  const trimmed = input.trim();

  if (!trimmed.startsWith("/")) {
    return null;
  }

  const [rawCommand, ...rest] = trimmed.slice(1).split(/\s+/);
  const command = rawCommand.toLowerCase();
  const argument = rest.length > 0 ? rest.join(" ").trim() : null;

  switch (command) {
    case "help":
    case "provider":
    case "status":
    case "history":
    case "doctor":
    case "sync":
    case "work":
    case "setup":
    case "clear":
    case "exit":
      return {
        command,
        argument
      };
    default:
      return null;
  }
}

async function maybeConfigureProvider(
  provider: ProviderId,
  context: {
    streams?: TerminalStreams;
    question?: import("../lib/terminal.js").TerminalQuestion;
  } = {}
): Promise<void> {
  const providers = await runProviders();
  const status = providers.providers.find((entry) => entry.id === provider);

  if (!status?.configured || !status.authenticated) {
    await ensureProviderConfiguration(provider, context);
  }
}

export async function runSessionShell(options: SessionShellOptions): Promise<void> {
  const output = options.streams?.output ?? process.stdout;
  let sessionContext = options.sessionContext;
  let provider = options.provider ?? null;
  let history = createSessionHistory(sessionContext);
  let promptSession = createQuestionSession(options.streams);

  writeLine(
    output,
    renderPanel({
      title: provider
        ? renderBrandTitle("forTheAgent Session", formatProviderLabel(provider))
        : renderBrandTitle("forTheAgent Session"),
      subtitle: "Documentation workflows with provider help only when needed",
      lines: [
        ...renderKeyValueLines([
          ["Repository", options.cwd],
          [
            "Provider",
            provider ? formatProviderLabel(provider) : "connect on demand"
          ]
        ]),
        {
          text: "Built-ins  gd · explain this repository · architecture · next steps · review",
          tone: "subtle"
        },
        {
          text: "Commands   /help · /provider · /status · /history · /doctor · /sync · /work · /setup · /clear · /exit",
          tone: "subtle"
        }
      ]
      ,
      accent: getProviderAccent(provider ? formatProviderLabel(provider) : null)
    })
  );
  writeLine(output);

  const resetPromptSession = (): void => {
    promptSession.close();
    promptSession = createQuestionSession(options.streams);
  };

  async function reloadSessionContext(settings: { resetConversation?: boolean } = {}): Promise<void> {
    const nextContext = await buildSessionContext(options.cwd);

    if (settings.resetConversation) {
      sessionContext = nextContext;
      history = createSessionHistory(sessionContext);
      return;
    }

    const existingConversation = history.filter((entry) => entry.role !== "system");
    sessionContext = nextContext;
    history = [...createSessionHistory(sessionContext), ...existingConversation];
  }

  function parseWorkArgument(argument: string | null): {
    mode?: "design" | "implementation" | "maintenance";
    activeWorkItem?: string;
    archiveActive?: boolean;
  } {
    if (!argument) {
      return {};
    }

    const [firstToken, ...rest] = argument.split(/\s+/).filter(Boolean);
    const normalizedFirstToken = firstToken.toLowerCase();

    if (
      normalizedFirstToken === "design" ||
      normalizedFirstToken === "implementation" ||
      normalizedFirstToken === "maintenance"
    ) {
      return {
        mode: normalizedFirstToken,
        activeWorkItem: rest.length > 0 ? rest.join(" ") : undefined
      };
    }

    if (normalizedFirstToken === "done" || normalizedFirstToken === "archive") {
      return {
        archiveActive: true,
        activeWorkItem: rest.length > 0 ? rest.join(" ") : undefined
      };
    }

    return {
      activeWorkItem: [firstToken, ...rest].join(" ")
    };
  }

  async function ensureActiveProvider(): Promise<ProviderId> {
    promptSession.close();
    const selectedProvider = await resolveProviderSelection(provider ?? undefined, {
      streams: options.streams
    });
    resetPromptSession();

    await maybeConfigureProvider(selectedProvider, {
      streams: options.streams,
      question: promptSession.question
    });

    if (provider !== selectedProvider) {
      provider = selectedProvider;
      writeLine(
        output,
        renderNoticePanel({
          title: "Provider Connected",
          message: `${formatProviderLabel(provider)} connected.`,
          details: ["Provider-backed tasks will now use this session backend."],
          accent: getProviderAccent(formatProviderLabel(provider))
        })
      );
    }

    return selectedProvider;
  }

  async function sendMessage(message: string, providerMessage = message): Promise<void> {
    const activeProvider = await ensureActiveProvider();
    const adapter = getProviderAdapter(activeProvider);
    let renderedText = false;
    let accumulatedText = "";
    let renderedAssistantHeader = false;

    const result = await adapter.sendTurn(
      sessionContext,
      {
        history,
        userMessage: providerMessage
      },
      {
        streams: options.streams,
        onEvent: async (event: ProviderTurnEvent) => {
          if (event.type === "status") {
            writeLine(output, renderEventLine("status", event.message));
            return;
          }

          if (event.type === "tool-activity") {
            writeLine(output, renderEventLine("tool", event.message));
            return;
          }

          if (event.type === "error") {
            writeLine(output, renderEventLine("error", event.message));
            return;
          }

          if (event.type === "text-delta") {
            if (!renderedText) {
              writeLine(output);
              writeLine(output, renderEventLine("assistant", `${formatProviderLabel(activeProvider)} reply`));
              renderedText = true;
              renderedAssistantHeader = true;
            }

            accumulatedText += event.text;
            output.write(event.text);
            return;
          }

          if (event.type === "done" && renderedText) {
            output.write("\n");
          }
        }
      }
    );

    const responseText = result.responseText || accumulatedText;

    if (!renderedText && responseText) {
      writeLine(output);
      writeLine(
        output,
        renderAssistantBlock({
          title: `${renderProviderName(formatProviderLabel(activeProvider))} reply`,
          subtitle: "Assistant response",
          text: responseText,
          accent: getProviderAccent(formatProviderLabel(activeProvider))
        })
      );
    } else if (renderedAssistantHeader && !responseText.trim()) {
      writeLine(output, renderEventLine("assistant", "No response text received."));
    }

    history = [
      ...history,
      {
        role: "user",
        content: providerMessage
      },
      {
        role: "assistant",
        content: responseText
      }
    ];
  }

  async function runBuiltInMessage(message: string): Promise<boolean> {
    const workflow = routeBuiltInWorkflow(message);

    if (!workflow) {
      return false;
    }

    const result = await runBuiltInWorkflow({
      cwd: options.cwd,
      sessionContext,
      workflow
      ,
      userMessage: message
    });

    if (!result.handled) {
      return false;
    }

    writeLine(
      output,
      looksLikePanel(result.responseText)
        ? result.responseText
        : renderAssistantBlock({
            title: "forTheAgent",
            subtitle: "Built-in workflow response",
            text: result.responseText
          })
    );

    if (result.reloadContext) {
      await reloadSessionContext();
    }

    history = [
      ...history,
      {
        role: "user",
        content: message
      },
      {
        role: "assistant",
        content: result.responseText
      }
    ];

    return true;
  }

  async function handlePlainInput(message: string): Promise<void> {
    if (await runBuiltInMessage(message)) {
      return;
    }

    const workflow = classifyProviderWorkflow(message);
    writeLine(output, renderEventLine("workflow", workflow.label));
    await sendMessage(message, buildProviderWorkflowPrompt(workflow, message));
  }

  if (options.initialMessage?.trim()) {
    await handlePlainInput(options.initialMessage.trim());
  }

  try {
    while (true) {
      let input = "";

      try {
        input = (await promptSession.question(renderPromptLabel("fortheagent> "))).trim();
      } catch (error) {
        if (error instanceof TerminalClosedError) {
          break;
        }

        throw error;
      }

      if (!input) {
        continue;
      }

      const command = parseSessionCommand(input);

      if (!command) {
        try {
          await handlePlainInput(input);
        } catch (error) {
          writeLine(output, renderEventLine("error", (error as Error).message));
        }
        continue;
      }

      if (command.command === "exit") {
        break;
      }

      if (command.command === "help") {
        writeLine(output, renderHelp());
        continue;
      }

      if (command.command === "clear") {
        history = createSessionHistory(sessionContext);
        writeLine(
          output,
          renderNoticePanel({
            title: "Conversation Reset",
            message: "Conversation cleared.",
            details: ["System context is preserved and user/assistant turns were removed."],
            accent: getProviderAccent(provider ? formatProviderLabel(provider) : null)
          })
        );
        continue;
      }

      if (command.command === "status") {
        writeLine(output, renderStatus(await runStatus({ cwd: options.cwd })));
        continue;
      }

      if (command.command === "history") {
        writeLine(output, renderHistory(await runHistory({ cwd: options.cwd })));
        continue;
      }

      if (command.command === "doctor") {
        writeLine(output, renderDoctor(await runDoctor({ cwd: options.cwd })));
        continue;
      }

      if (command.command === "sync") {
        const result = await runSync({ cwd: options.cwd });
        await reloadSessionContext();
        writeLine(output, renderSync(result));
        continue;
      }

      if (command.command === "work") {
        try {
          const result = await runWork({
            cwd: options.cwd,
            ...parseWorkArgument(command.argument)
          });
          await reloadSessionContext();
          writeLine(output, renderWork(result));
        } catch (error) {
          writeLine(output, renderEventLine("error", (error as Error).message));
        }
        continue;
      }

      if (command.command === "setup") {
        promptSession.close();
        await runGuidedSetup({
          cwd: options.cwd,
          streams: options.streams
        });
        await reloadSessionContext({ resetConversation: true });
        promptSession = createQuestionSession(options.streams);
        writeLine(
          output,
          renderNoticePanel({
            title: "Session Reloaded",
            message: "Session context reloaded.",
            details: ["Updated repository docs and manifest are now active in this session."],
            accent: getProviderAccent(provider ? formatProviderLabel(provider) : null)
          })
        );
        continue;
      }

      promptSession.close();
      const nextProvider = await resolveProviderSelection(command.argument ?? undefined, {
        streams: options.streams
      });
      promptSession = createQuestionSession(options.streams);
      await maybeConfigureProvider(nextProvider, {
        streams: options.streams,
        question: promptSession.question
      });
      provider = nextProvider;
      sessionContext = await buildSessionContext(options.cwd);
      history = createSessionHistory(sessionContext);
      writeLine(
        output,
        renderNoticePanel({
          title: "Provider Switched",
          message: `Provider set to ${formatProviderLabel(provider)}.`,
          details: ["Conversation cleared.", "Session context was rebuilt for the new provider."],
          accent: getProviderAccent(formatProviderLabel(provider))
        })
      );
    }
  } finally {
    promptSession.close();
  }
}

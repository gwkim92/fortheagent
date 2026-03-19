import { createInterface } from "node:readline/promises";
import { emitKeypressEvents } from "node:readline";
import { stdin as defaultInput, stdout as defaultOutput } from "node:process";
import {
  TerminalAbortError,
  TerminalClosedError,
  rethrowAsTerminalAbort
} from "./abort.js";

export type TerminalStreams = {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
};

export type TerminalQuestion = (message: string) => Promise<string>;
export type MenuOption<T> = {
  label: string;
  value: T;
  keywords?: string[];
};

const menuChrome = {
  accent: "\u001b[38;5;121m",
  border: "\u001b[38;5;80m",
  body: "\u001b[38;5;252m",
  subtle: "\u001b[38;5;246m",
  selectedBackground: "\u001b[48;5;23m",
  bold: "\u001b[1m",
  reset: "\u001b[0m"
} as const;

const MIN_MENU_WIDTH = 54;
const MAX_MENU_WIDTH = 96;

type RawCapableInput = NodeJS.ReadableStream & {
  isTTY?: boolean;
  setRawMode?(enabled: boolean): void;
  resume?(): void;
  pause?(): void;
};

export function createQuestionSession(streams: TerminalStreams = {}): {
  question: TerminalQuestion;
  close(): void;
} {
  const rl = createInterface({
    input: streams.input ?? defaultInput,
    output: streams.output ?? defaultOutput
  });

  return {
    async question(message: string): Promise<string> {
      try {
        return (await rl.question(message)).trim();
      } catch (error) {
        rethrowAsTerminalAbort(error);
      }
    },
    close(): void {
      rl.close();
    }
  };
}

export async function promptForText(
  message: string,
  streams: TerminalStreams = {}
): Promise<string> {
  const session = createQuestionSession(streams);

  try {
    return await session.question(message);
  } finally {
    session.close();
  }
}

function canUseRawInput(streams: TerminalStreams = {}): streams is TerminalStreams & {
  input: RawCapableInput;
} {
  const input = (streams.input ?? defaultInput) as RawCapableInput;
  return Boolean(input.isTTY && typeof input.setRawMode === "function");
}

export async function promptForHotkeyOrText(config: {
  promptLabel: string;
  hotkeys: readonly string[];
  streams?: TerminalStreams;
}): Promise<string> {
  if (!canUseRawInput(config.streams)) {
    return promptForText(config.promptLabel, config.streams);
  }

  const input = (config.streams?.input ?? defaultInput) as RawCapableInput;
  const output = config.streams?.output ?? defaultOutput;
  const hotkeys = new Set(config.hotkeys);

  return new Promise<string>((resolve, reject) => {
    let buffer = "";
    let settled = false;

    const cleanup = (): void => {
      input.off("keypress", onKeypress);
      input.off("end", onClosed);
      input.off("close", onClosed);
      input.setRawMode?.(false);
    };

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      handler();
    };

    const onClosed = (): void => {
      finish(() => reject(new TerminalClosedError()));
    };

    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        output.write("^C\n");
        finish(() => reject(new TerminalAbortError()));
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        output.write("\n");
        finish(() => resolve(buffer.trim()));
        return;
      }

      if (key.name === "backspace" || key.name === "delete") {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          output.write("\b \b");
        }
        return;
      }

      if (!buffer && hotkeys.has(text)) {
        output.write(`${text}\n`);
        finish(() => resolve(text));
        return;
      }

      if (text && /^[ -~]$/.test(text)) {
        buffer += text;
        output.write(text);
      }
    };

    output.write(config.promptLabel);
    emitKeypressEvents(input);
    input.setRawMode?.(true);
    input.resume?.();
    input.on("keypress", onKeypress);
    input.on("end", onClosed);
    input.on("close", onClosed);
  });
}

function stripAnsi(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function resolveMenuInnerWidth(
  output: NodeJS.WritableStream,
  title: string,
  footer: string,
  bodyLines: string[]
): number {
  const contentWidth = Math.max(
    MIN_MENU_WIDTH,
    stripAnsi(title).length + 2,
    stripAnsi(footer).length,
    ...bodyLines.map((line) => stripAnsi(line).length)
  );
  const terminalColumns =
    typeof (output as NodeJS.WritableStream & { columns?: number }).columns === "number"
      ? (output as NodeJS.WritableStream & { columns?: number }).columns
      : undefined;

  if (typeof terminalColumns === "number" && Number.isFinite(terminalColumns)) {
    const availableWidth = Math.max(MIN_MENU_WIDTH, Math.floor(terminalColumns) - 4);
    return Math.min(Math.max(contentWidth, MIN_MENU_WIDTH), Math.min(availableWidth, MAX_MENU_WIDTH));
  }

  return Math.min(Math.max(contentWidth, MIN_MENU_WIDTH), MAX_MENU_WIDTH);
}

function renderMenuContainer(config: {
  title: string;
  footer: string;
  bodyLines: string[];
  output: NodeJS.WritableStream;
}): string[] {
  const innerWidth = resolveMenuInnerWidth(
    config.output,
    config.title,
    config.footer,
    config.bodyLines
  );
  const padVisible = (value: string): string =>
    `${value}${" ".repeat(Math.max(0, innerWidth - stripAnsi(value).length))}`;
  const frameLine = (value: string): string =>
    `${menuChrome.border}│${menuChrome.reset} ${padVisible(value)} ${menuChrome.border}│${menuChrome.reset}`;
  const divider = `${menuChrome.border}├${"─".repeat(innerWidth + 2)}┤${menuChrome.reset}`;
  const titleDashCount = Math.max(0, innerWidth - stripAnsi(config.title).length - 1);
  const lines: string[] = [];

  lines.push(
    `${menuChrome.border}╭─ ${menuChrome.accent}${menuChrome.bold}${config.title}${menuChrome.reset} ${menuChrome.border}${"─".repeat(titleDashCount)}╮${menuChrome.reset}`
  );
  lines.push(frameLine(`${menuChrome.subtle}${config.footer}${menuChrome.reset}`));
  lines.push(divider);

  for (const line of config.bodyLines) {
    lines.push(frameLine(line));
  }

  lines.push(`${menuChrome.border}╰${"─".repeat(innerWidth + 2)}╯${menuChrome.reset}`);
  return lines;
}

function renderMenuFrame<T>(
  options: MenuOption<T>[],
  selectedIndex: number,
  title: string | undefined,
  output: NodeJS.WritableStream
): string[] {
  return renderMenuContainer({
    title: title ?? "Select an option",
    footer: "Use ↑ ↓ to move and Enter to confirm.",
    output,
    bodyLines: options.map((option, index) => {
      const selected = index === selectedIndex;
      const prefix = selected
        ? `${menuChrome.accent}${menuChrome.bold}›${menuChrome.reset}`
        : `${menuChrome.subtle} ${menuChrome.reset}`;
      const label = selected
        ? `${menuChrome.selectedBackground}${menuChrome.accent}${menuChrome.bold}${option.label}${menuChrome.reset}`
        : `${menuChrome.body}${option.label}${menuChrome.reset}`;
      return `${prefix} ${label}`;
    })
  });
}

function renderChecklistFrame<T>(
  options: MenuOption<T>[],
  selectedIndex: number,
  checkedIndices: Set<number>,
  title: string | undefined,
  output: NodeJS.WritableStream
): string[] {
  return renderMenuContainer({
    title: title ?? "Select one or more options",
    footer: "Use ↑ ↓ to move, Space to toggle, Enter to confirm.",
    output,
    bodyLines: options.map((option, index) => {
      const focused = index === selectedIndex;
      const checked = checkedIndices.has(index);
      const prefix = focused
        ? `${menuChrome.accent}${menuChrome.bold}›${menuChrome.reset}`
        : `${menuChrome.subtle} ${menuChrome.reset}`;
      const marker = checked
        ? `${menuChrome.accent}${menuChrome.bold}[x]${menuChrome.reset}`
        : `${menuChrome.subtle}[ ]${menuChrome.reset}`;
      const label = focused
        ? `${menuChrome.selectedBackground}${menuChrome.body}${menuChrome.bold}${option.label}${menuChrome.reset}`
        : `${menuChrome.body}${option.label}${menuChrome.reset}`;
      return `${prefix} ${marker} ${label}`;
    })
  });
}

function canUseSelectionMenu(streams: TerminalStreams = {}): streams is TerminalStreams & {
  input: RawCapableInput;
} {
  return canUseRawInput(streams);
}

export async function promptForMenuSelection<T>(config: {
  title?: string;
  options: MenuOption<T>[];
  streams?: TerminalStreams;
  fallbackPrompt?: string;
}): Promise<T> {
  if (config.options.length === 0) {
    throw new Error("promptForMenuSelection requires at least one option");
  }

  if (!canUseSelectionMenu(config.streams)) {
    while (true) {
      const answer = (
        await promptForText(config.fallbackPrompt ?? "Choose an option: ", config.streams)
      )
        .trim()
        .toLowerCase();

      const matched = config.options.find((option, index) => {
        const indexKey = String(index + 1);
        return (
          answer === indexKey ||
          option.keywords?.some((keyword) => answer === keyword.toLowerCase()) ||
          answer === option.label.toLowerCase()
        );
      });

      if (matched) {
        return matched.value;
      }

      const output = config.streams?.output ?? defaultOutput;
      output.write("Invalid selection\n");
    }
  }

  const input = (config.streams?.input ?? defaultInput) as RawCapableInput;
  const output = config.streams?.output ?? defaultOutput;

  return new Promise<T>((resolve, reject) => {
    let selectedIndex = 0;
    let renderedLineCount = 0;
    let settled = false;

    const render = (): void => {
      const lines = renderMenuFrame(config.options, selectedIndex, config.title, output);

      if (renderedLineCount > 0) {
        output.write(`\u001b[${renderedLineCount}F`);
      }

      for (const line of lines) {
        output.write("\u001b[2K");
        output.write(`${line}\n`);
      }

      renderedLineCount = lines.length;
    };

    const cleanup = (): void => {
      input.off("keypress", onKeypress);
      input.off("end", onClosed);
      input.off("close", onClosed);
      input.setRawMode?.(false);
      output.write("\u001b[?25h");
    };

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      handler();
    };

    const onClosed = (): void => {
      finish(() => reject(new TerminalClosedError()));
    };

    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        finish(() => reject(new TerminalAbortError()));
        return;
      }

      if (key.name === "up") {
        selectedIndex = selectedIndex === 0 ? config.options.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (key.name === "down") {
        selectedIndex = (selectedIndex + 1) % config.options.length;
        render();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        output.write("\n");
        finish(() => resolve(config.options[selectedIndex].value));
        return;
      }

      const digit = text.trim();
      if (/^[1-9]$/.test(digit)) {
        const numericIndex = Number(digit) - 1;
        if (numericIndex >= 0 && numericIndex < config.options.length) {
          selectedIndex = numericIndex;
          render();
        }
      }
    };

    emitKeypressEvents(input);
    input.setRawMode?.(true);
    input.resume?.();
    output.write("\u001b[?25l");
    render();
    input.on("keypress", onKeypress);
    input.on("end", onClosed);
    input.on("close", onClosed);
  });
}

export async function promptForChecklistSelection<T>(config: {
  title?: string;
  options: MenuOption<T>[];
  streams?: TerminalStreams;
  fallbackPrompt?: string;
  initialSelected?: readonly T[];
}): Promise<T[]> {
  if (config.options.length === 0) {
    return [];
  }

  if (!canUseSelectionMenu(config.streams)) {
    while (true) {
      const answer = (
        await promptForText(
          config.fallbackPrompt ?? "Choose one or more options (comma-separated): ",
          config.streams
        )
      )
        .trim()
        .toLowerCase();

      if (!answer) {
        return [];
      }

      const tokens = answer
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean);
      const resolved: T[] = [];
      let invalid = false;

      for (const token of tokens) {
        const matched = config.options.find((option, index) => {
          const indexKey = String(index + 1);
          return (
            token === indexKey ||
            option.keywords?.some((keyword) => token === keyword.toLowerCase()) ||
            token === option.label.toLowerCase()
          );
        });

        if (!matched) {
          invalid = true;
          break;
        }

        if (!resolved.includes(matched.value)) {
          resolved.push(matched.value);
        }
      }

      if (!invalid) {
        return resolved;
      }

      const output = config.streams?.output ?? defaultOutput;
      output.write("Invalid selection\n");
    }
  }

  const input = (config.streams?.input ?? defaultInput) as RawCapableInput;
  const output = config.streams?.output ?? defaultOutput;
  const checkedIndices = new Set<number>();

  for (const initialValue of config.initialSelected ?? []) {
    const index = config.options.findIndex((option) => Object.is(option.value, initialValue));
    if (index >= 0) {
      checkedIndices.add(index);
    }
  }

  return new Promise<T[]>((resolve, reject) => {
    let selectedIndex = 0;
    let renderedLineCount = 0;
    let settled = false;

    const render = (): void => {
      const lines = renderChecklistFrame(
        config.options,
        selectedIndex,
        checkedIndices,
        config.title,
        output
      );

      if (renderedLineCount > 0) {
        output.write(`\u001b[${renderedLineCount}F`);
      }

      for (const line of lines) {
        output.write("\u001b[2K");
        output.write(`${line}\n`);
      }

      renderedLineCount = lines.length;
    };

    const cleanup = (): void => {
      input.off("keypress", onKeypress);
      input.off("end", onClosed);
      input.off("close", onClosed);
      input.setRawMode?.(false);
      output.write("\u001b[?25h");
    };

    const finish = (handler: () => void): void => {
      if (settled) {
        return;
      }

      settled = true;
      cleanup();
      handler();
    };

    const onClosed = (): void => {
      finish(() => reject(new TerminalClosedError()));
    };

    const onKeypress = (text: string, key: { name?: string; ctrl?: boolean }): void => {
      if (key.ctrl && key.name === "c") {
        finish(() => reject(new TerminalAbortError()));
        return;
      }

      if (key.name === "up") {
        selectedIndex = selectedIndex === 0 ? config.options.length - 1 : selectedIndex - 1;
        render();
        return;
      }

      if (key.name === "down") {
        selectedIndex = (selectedIndex + 1) % config.options.length;
        render();
        return;
      }

      if (key.name === "space") {
        if (checkedIndices.has(selectedIndex)) {
          checkedIndices.delete(selectedIndex);
        } else {
          checkedIndices.add(selectedIndex);
        }
        render();
        return;
      }

      if (key.name === "return" || key.name === "enter") {
        output.write("\n");
        finish(() =>
          resolve(
            Array.from(checkedIndices)
              .sort((left, right) => left - right)
              .map((index) => config.options[index].value)
          )
        );
        return;
      }

      const digit = text.trim();
      if (/^[1-9]$/.test(digit)) {
        const numericIndex = Number(digit) - 1;
        if (numericIndex >= 0 && numericIndex < config.options.length) {
          if (checkedIndices.has(numericIndex)) {
            checkedIndices.delete(numericIndex);
          } else {
            checkedIndices.add(numericIndex);
          }
          selectedIndex = numericIndex;
          render();
        }
      }
    };

    emitKeypressEvents(input);
    input.setRawMode?.(true);
    input.resume?.();
    output.write("\u001b[?25l");
    render();
    input.on("keypress", onKeypress);
    input.on("end", onClosed);
    input.on("close", onClosed);
  });
}

export async function promptUntilValid<T>(config: {
  message: string;
  streams?: TerminalStreams;
  parse(input: string): T | null;
  onInvalid?: string;
}): Promise<T> {
  const output = config.streams?.output ?? defaultOutput;

  while (true) {
    const answer = await promptForText(config.message, config.streams);
    const parsed = config.parse(answer);

    if (parsed !== null) {
      return parsed;
    }

    output.write(`${config.onInvalid ?? "Invalid input"}\n`);
  }
}

export async function runLineRepl(config: {
  promptLabel?: string;
  streams?: TerminalStreams;
  onMessage(message: string): Promise<string>;
}): Promise<void> {
  const output = config.streams?.output ?? defaultOutput;
  const rl = createInterface({
    input: config.streams?.input ?? defaultInput,
    output
  });

  try {
    while (true) {
      let line: string;

      try {
        line = (await rl.question(config.promptLabel ?? "prompt> ")).trim();
      } catch (error) {
        rethrowAsTerminalAbort(error);
      }

      if (!line) {
        continue;
      }

      if (line === "exit" || line === "/exit" || line === "quit" || line === "/quit") {
        break;
      }

      const response = await config.onMessage(line);
      output.write(`${response}\n`);
    }
  } finally {
    rl.close();
  }
}

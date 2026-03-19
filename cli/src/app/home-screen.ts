import { resolveViewportWidth } from "./chrome.js";

const ansi = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  border: "\u001b[38;5;80m",
  heading: "\u001b[38;5;121m",
  body: "\u001b[38;5;252m",
  subtle: "\u001b[38;5;246m"
} as const;

function crop(text: string, width: number): string {
  if (text.length <= width) {
    return text;
  }

  if (width <= 3) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 3)}...`;
}

function compactPath(value: string, width: number): string {
  if (value.length <= width) {
    return value;
  }

  const tailWidth = Math.max(12, width - 4);
  return `...${value.slice(-tailWidth)}`;
}

function style(text: string, ...codes: string[]): string {
  if (codes.length === 0) {
    return text;
  }

  return `${codes.join("")}${text}${ansi.reset}`;
}

function renderTargetLine(): string {
  return [
    style("Targets  ", ansi.subtle),
    style("Codex", "\u001b[38;5;117m", ansi.bold),
    style(" · ", ansi.subtle),
    style("Claude Code", "\u001b[38;5;216m", ansi.bold),
    style(" · ", ansi.subtle),
    style("Gemini CLI", "\u001b[38;5;150m", ansi.bold)
  ].join("");
}

function plain(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function frameTop(title: string, boxWidth: number): string {
  const titleWidth = plain(title).length;
  const dashCount = Math.max(0, boxWidth - 5 - titleWidth);

  return [
    style("╭─ ", ansi.border),
    title,
    style(` ${"─".repeat(dashCount)}╮`, ansi.border)
  ].join("");
}

function frameBottom(boxWidth: number): string {
  return style(`╰${"─".repeat(boxWidth - 2)}╯`, ansi.border);
}

function frameDivider(boxWidth: number): string {
  return style(`├${"─".repeat(boxWidth - 2)}┤`, ansi.border);
}

function frameColumnDivider(leftWidth: number, rightWidth: number): string {
  return style(
    `├${"─".repeat(leftWidth + 1)}┼${"─".repeat(rightWidth + 1)}┤`,
    ansi.border
  );
}

function frameLine(content = "", boxWidth: number): string {
  const visible = plain(content);
  return `${style("│", ansi.border)}${content}${" ".repeat(
    Math.max(0, boxWidth - 2 - visible.length)
  )}${style("│", ansi.border)}`;
}

function splitRow(
  left: string,
  right = "",
  leftWidth: number,
  rightWidth: number,
  leftTone: string = ansi.body,
  rightTone: string = ansi.body
): string {
  const leftCell = style(crop(left, leftWidth).padEnd(leftWidth, " "), leftTone);
  const rightCell = style(crop(right, rightWidth).padEnd(rightWidth, " "), rightTone);

  return [
    style("│", ansi.border),
    " ",
    leftCell,
    style("│", ansi.border),
    " ",
    rightCell,
    style("│", ansi.border)
  ].join("");
}

function renderPairedRows(
  leftLines: Array<{ text: string; tone?: string }>,
  rightLines: Array<{ text: string; tone?: string }>,
  leftWidth: number,
  rightWidth: number
): string[] {
  const rows: string[] = [];
  const maxRows = Math.max(leftLines.length, rightLines.length);

  for (let index = 0; index < maxRows; index += 1) {
    const left = leftLines[index] ?? { text: "", tone: ansi.body };
    const right = rightLines[index] ?? { text: "", tone: ansi.body };
    rows.push(
      splitRow(
        left.text,
        right.text,
        leftWidth,
        rightWidth,
        left.tone ?? ansi.body,
        right.tone ?? ansi.body
      )
    );
  }

  return rows;
}

export function renderHomeScreen(cwd: string, width?: number): string {
  const boxWidth = resolveViewportWidth(width);
  const innerWidth = boxWidth - 2;
  const leftWidth = clamp(Math.floor(innerWidth * 0.33), 24, 30);
  const rightWidth = innerWidth - 3 - leftWidth;

  const mascot = [
    { text: "", tone: ansi.body },
    { text: "", tone: ansi.body },
    { text: "        ╭─╮", tone: ansi.heading },
    { text: "     ╭──┴─┴──╮", tone: ansi.heading },
    { text: "    ╭┤  ◕ ◕  ├╮", tone: ansi.heading },
    { text: "    ││   ▿   ││", tone: ansi.heading },
    { text: "    ││  ╭─╮  ││", tone: ansi.heading },
    { text: "    │╰──┴─┴──╯│", tone: ansi.heading },
    { text: "    ╰─╮  ╷  ╭─╯", tone: ansi.heading },
    { text: "      ╰──┴──╯", tone: ansi.heading },
    { text: "", tone: ansi.body },
    { text: "    docs companion", tone: `${ansi.heading}${ansi.bold}` },
    { text: "    rules · skills · roots", tone: ansi.subtle },
    { text: "", tone: ansi.body },
    { text: "    AGENTS.md", tone: ansi.body },
    { text: "    CLAUDE.md", tone: "\u001b[38;5;216m" },
    { text: "    GEMINI.md", tone: "\u001b[38;5;150m" }
  ];

  const intro = [
    { text: "Docs foundation for coding agents", tone: `${ansi.heading}${ansi.bold}` },
    { text: "Install AGENTS.md, CLAUDE.md, and GEMINI.md.", tone: ansi.body },
    { text: "Keep rules, skills, and projections aligned.", tone: ansi.body },
    { text: "", tone: ansi.body },
    { text: "Start with [1] for a new or broken repo.", tone: ansi.body },
    { text: "Start with [2] for refresh, review, or docs help.", tone: ansi.body },
    { text: "Type the work directly to skip the menu.", tone: ansi.body },
    { text: "", tone: ansi.body },
    { text: plain(renderTargetLine()), tone: ansi.subtle }
  ];

  const setupMode = [
    { text: "[1] Guided Setup", tone: `${ansi.heading}${ansi.bold}` },
    { text: "Structured questions", tone: ansi.body },
    { text: "Discover stack", tone: ansi.body },
    { text: "Mark important concerns", tone: ansi.body },
    { text: "Generate or repair docs", tone: ansi.body },
    { text: "No provider required", tone: ansi.subtle }
  ];

  const askMode = [
    { text: "[2] Ask forTheAgent", tone: `${ansi.heading}${ansi.bold}` },
    { text: "Goal-first doc work", tone: ansi.body },
    { text: "Local workflows first", tone: ansi.body },
    { text: "Attach provider only when needed", tone: ansi.body },
    { text: "gd · explain · architecture · review", tone: ansi.subtle }
  ];

  return [
    frameTop(style("⌁[◕▿◕] forTheAgent", ansi.heading, ansi.bold), boxWidth),
    ...renderPairedRows(mascot, intro, leftWidth, rightWidth),
    frameColumnDivider(leftWidth, rightWidth),
    ...renderPairedRows(setupMode, askMode, leftWidth, rightWidth),
    frameDivider(boxWidth),
    frameLine(style(` Workspace   ${compactPath(cwd, boxWidth - 14)}`, ansi.subtle), boxWidth),
    frameLine(renderTargetLine(), boxWidth),
    frameLine(style(" Quick starts  gd · explain this repository · architecture", ansi.body), boxWidth),
    frameLine(style("               review auth flow · codex review auth flow", ansi.body), boxWidth),
    frameLine(style(" Selector below  [1] Setup · [2] Ask · [3] Type directly", ansi.body), boxWidth),
    frameBottom(boxWidth)
  ].join("\n");
}

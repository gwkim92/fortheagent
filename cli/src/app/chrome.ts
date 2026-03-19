const DEFAULT_BOX_WIDTH = 78;
const MIN_BOX_WIDTH = 72;

const ansi = {
  reset: "\u001b[0m",
  bold: "\u001b[1m",
  border: "\u001b[38;5;80m",
  heading: "\u001b[38;5;121m",
  body: "\u001b[38;5;252m",
  subtle: "\u001b[38;5;246m",
  codex: "\u001b[38;5;117m",
  claude: "\u001b[38;5;216m",
  gemini: "\u001b[38;5;150m",
  openai: "\u001b[38;5;81m",
  anthropic: "\u001b[38;5;209m",
  oauth: "\u001b[38;5;123m"
} as const;

function style(text: string, ...codes: string[]): string {
  if (codes.length === 0) {
    return text;
  }

  return `${codes.join("")}${text}${ansi.reset}`;
}

export function resolveViewportWidth(width?: number, columns?: number): number {
  if (typeof width === "number" && Number.isFinite(width)) {
    return Math.max(MIN_BOX_WIDTH, Math.floor(width));
  }

  if (typeof columns === "number" && Number.isFinite(columns)) {
    return Math.max(MIN_BOX_WIDTH, Math.floor(columns) - 2);
  }

  if (typeof process.stdout.columns === "number" && Number.isFinite(process.stdout.columns)) {
    return Math.max(MIN_BOX_WIDTH, Math.floor(process.stdout.columns) - 2);
  }

  return DEFAULT_BOX_WIDTH;
}

export function getBrandGlyphText(): string {
  return "⌁[◕▿◕]";
}

export function renderBrandGlyph(): string {
  return style(getBrandGlyphText(), ansi.heading, ansi.bold);
}

export function renderBrandTitle(label: string, suffix?: string): string {
  return `${getBrandGlyphText()} ${label}${suffix ? ` // ${suffix}` : ""}`;
}

function plain(value: string): string {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

function crop(text: string, width: number): string {
  if (text.length <= width) {
    return text;
  }

  if (width <= 3) {
    return text.slice(0, width);
  }

  return `${text.slice(0, width - 3)}...`;
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

function frameLine(content = "", innerWidth: number): string {
  const visible = plain(content);
  return `${style("│", ansi.border)}${content}${" ".repeat(
    Math.max(0, innerWidth - visible.length)
  )}${style("│", ansi.border)}`;
}

function frameBottom(innerWidth: number): string {
  return style(`╰${"─".repeat(innerWidth)}╯`, ansi.border);
}

function frameDivider(innerWidth: number): string {
  return style(`├${"─".repeat(innerWidth)}┤`, ansi.border);
}

export function renderPanel(config: {
  title: string;
  subtitle?: string;
  lines?: Array<{ text: string; tone?: "body" | "subtle" | "heading" }>;
  accent?: string;
  width?: number;
}): string {
  const accent = config.accent ?? ansi.heading;
  const boxWidth = resolveViewportWidth(config.width);
  const innerWidth = boxWidth - 2;
  const rendered = [frameTop(style(config.title, accent, ansi.bold), boxWidth)];

  if (config.subtitle) {
    rendered.push(frameLine(style(crop(config.subtitle, innerWidth), ansi.subtle), innerWidth));
  }

  if (config.lines && config.lines.length > 0) {
    if (config.subtitle) {
      rendered.push(frameDivider(innerWidth));
    }

    for (const line of config.lines) {
      const tone =
        line.tone === "heading" ? ansi.heading : line.tone === "subtle" ? ansi.subtle : ansi.body;
      rendered.push(frameLine(style(crop(line.text, innerWidth), tone), innerWidth));
    }
  }

  rendered.push(frameBottom(innerWidth));
  return rendered.join("\n");
}

export function renderKeyValueLines(values: Array<[string, string]>): Array<{
  text: string;
  tone?: "body" | "subtle";
}> {
  return values.map(([label, value]) => ({
    text: `${`${label}:`.padEnd(13, " ")} ${value}`,
    tone: "body"
  }));
}

export function renderFieldPrompt(config: {
  title: string;
  field: string;
  step?: number;
  total?: number;
  hint?: string;
}): string {
  const stepLabel =
    config.step && config.total ? `Field ${config.step}/${config.total}` : "Input field";

  return renderPanel({
    title: config.title,
    subtitle: stepLabel,
    lines: [
      { text: config.field },
      ...(config.hint ? [{ text: config.hint, tone: "subtle" as const }] : [])
    ]
  });
}

export function renderEventLine(kind: string, message: string): string {
  const badge =
    kind === "error"
      ? "✕"
      : kind === "tool"
        ? "⋯"
        : kind === "assistant"
          ? "◉"
          : kind === "workflow"
            ? "↺"
            : "•";
  const tone =
    kind === "error"
      ? ansi.heading
      : kind === "tool"
        ? ansi.subtle
        : kind === "assistant"
          ? ansi.heading
          : ansi.body;
  return style(`${badge} ${message}`, tone, ansi.bold);
}

export function renderPromptLabel(label: string): string {
  return `${renderBrandGlyph()} ${style(label, ansi.heading, ansi.bold)}`;
}

export function looksLikePanel(text: string): boolean {
  return plain(text).startsWith("╭─ ");
}

export function renderAssistantBlock(config: {
  title: string;
  subtitle?: string;
  text: string;
  accent?: string;
}): string {
  const lines = config.text.split("\n").map((line) => ({
    text: line || " ",
    tone: "body" as const
  }));

  return renderPanel({
    title: config.title,
    subtitle: config.subtitle,
    lines,
    accent: config.accent
  });
}

export function renderNoticePanel(config: {
  title: string;
  message: string;
  details?: string[];
  accent?: string;
}): string {
  return renderPanel({
    title: config.title,
    subtitle: config.message,
    lines: config.details?.map((detail) => ({ text: detail, tone: "subtle" as const })),
    accent: config.accent
  });
}

export function renderProviderName(name: string): string {
  const normalized = name.trim().toLowerCase();
  const tone =
    normalized.includes("codex")
      ? ansi.codex
      : normalized.includes("claude")
        ? ansi.claude
        : normalized.includes("gemini")
          ? ansi.gemini
          : normalized.includes("openai")
            ? ansi.openai
            : normalized.includes("anthropic")
              ? ansi.anthropic
              : normalized.includes("oauth")
                ? ansi.oauth
                : ansi.heading;

  return style(name, tone, ansi.bold);
}

export function getProviderAccent(name: string | null | undefined): string {
  const normalized = (name ?? "").trim().toLowerCase();

  if (normalized.includes("codex")) {
    return ansi.codex;
  }

  if (normalized.includes("claude")) {
    return ansi.claude;
  }

  if (normalized.includes("gemini")) {
    return ansi.gemini;
  }

  if (normalized.includes("openai")) {
    return ansi.openai;
  }

  if (normalized.includes("anthropic")) {
    return ansi.anthropic;
  }

  if (normalized.includes("oauth")) {
    return ansi.oauth;
  }

  return ansi.heading;
}

export const chromePalette = ansi;
